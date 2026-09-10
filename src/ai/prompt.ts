import type { AiChatMessage } from '@/api/ai';
import type { AiPlanKind } from '@/constants/ai';
import type { AiRequestContext } from '@/types/ai';

/**
 * Prompt assembly.
 *
 * The system layer is versioned. Changing it changes model behaviour for every user,
 * so it is treated as a code change rather than a tunable, and the version is stored
 * alongside every plan for reproducibility.
 */
export const PROMPT_VERSION = '3';

const PLAN_SCHEMA_HINT = `Return a single JSON object with exactly this shape:

{
  "kind": "workout" | "nutrition" | "combined",
  "title": string,
  "summary": string,
  "horizonDays": number,
  "workouts": [
    {
      "name": string,
      "dayOffset": number,
      "focus": string,
      "exercises": [
        {
          "exerciseId": string,
          "name": string,
          "sets": number,
          "warmupSets": number | null,
          "reps": number | null,
          "weight": number | null,
          "timeSeconds": number | null,
          "distance": number | null,
          "restSeconds": number | null,
          "notes": string | null
        }
      ]
    }
  ],
  "meals": [
    {
      "slot": "breakfast" | "lunch" | "dinner" | "snack",
      "dayOffset": number,
      "items": [
        {
          "name": string,
          "quantity": string,
          "calories": number,
          "proteinG": number,
          "carbsG": number,
          "fatG": number
        }
      ]
    }
  ],
  "targets": [
    { "dayOffset": number, "calories": number, "proteinG": number, "carbsG": number, "fatG": number }
  ]
}`;

/**
 * The two other shapes a plan request can answer with, instead of a plan.
 *
 * Both keep the response JSON-only: the request is always sent with
 * `response_format: json_object` (see src/api/ai.ts), so "reply in plain
 * prose instead" is not an option the transport allows — a shape has to carry
 * whatever the model needs to say, questions or a safety stop included.
 */
const ASSESSMENT_SCHEMA_HINT = `Before writing a plan, decide whether you actually know enough to write a safe
one for this specific person. Two things can stop you, and they are answered
with a different shape each — never a plan:

1. Not enough is known yet. You are missing, and nothing in USER PROFILE or
   the conversation above already answers, at least one of:
   - Any injury, joint issue, or diagnosed medical condition training or diet
     should account for — or a clear "none".
   - What equipment is actually available, when generating a workout — or a
     clear "bodyweight only".
   - Any dietary restriction or allergen, when generating a nutrition plan.

   Respond with exactly this instead of a plan:

   { "status": "need_info", "questions": [string, ...] }

   At most 3 questions, only for what is actually missing, asked together in
   one turn — never one question per turn, and never re-asking something
   USER PROFILE or the conversation already answered. Phrase them as a trainer
   would, not as a form.

2. Something in what the user described is a reason to stop, not to program
   around. Chest pain, fainting, numbness, an acute unassessed injury, or
   anything else that reads as needing a clinician before training at all.

   Respond with exactly this instead of a plan:

   { "status": "stop", "message": string }

   message is plain text for the user: say plainly that this needs a doctor or
   other qualified professional before training, in the language specified
   below. Do not diagnose what it might be.

If FORCE_READY appears in the request below, skip this assessment and go
straight to a plan under conservative, general-population assumptions for
whatever is still unknown — a cautious plan beats asking a question for the
third time in the same conversation.

Otherwise, once you know enough, respond with the plan itself:`;

const SYSTEM_RULES = `You are the training assistant inside FitSync, a workout tracking app.

Hard rules:
1. Every exerciseId you emit MUST come from the supplied exercise catalogue. Never
   invent an exercise or an id. If the catalogue lacks something you want, choose the
   closest available entry.
2. Never program an exercise that conflicts with a declared condition. If the user has
   declared a condition, prefer movements that avoid loading the affected area.
3. Never include a food that conflicts with a declared allergen or dietary pattern.
4. Only use equipment the user has declared. Bodyweight is always available.
5. Respect the user's stated sessions per week and session length.
6. You are not a medical professional. Do not diagnose, treat, or claim to cure
   anything. Do not present the plan as medical advice.

Style:
- Be concise and practical. Short sentences. No filler and no hype.
- Use the user's weight unit as supplied.
- When the user is only chatting, answer normally in plain prose.`;

const CHAT_SYSTEM = `${SYSTEM_RULES}

Answer the user's question directly. Do not return JSON. If the user asks for a plan,
a routine, a workout split, or a diet, tell them to use the plan buttons instead of
writing the plan out in the chat.`;

const PLAN_SYSTEM = `${SYSTEM_RULES}

You are generating a structured plan. Respond with JSON only, no prose, no markdown
fence.

${ASSESSMENT_SCHEMA_HINT}

${PLAN_SCHEMA_HINT}

Condition guidance. When CONDITION GUIDANCE appears in the request below, it is
reviewed, human-written material for a condition this user declared — you may
repeat it to them as-is. Its "avoid" list is absolute: never program a movement
that matches it, not even a lighter or modified version, regardless of what else
the plan is trying to achieve.

Rules for the payload:
- dayOffset is zero-based: 0 is the first day of the plan.
- For a "workout" plan leave "meals" and "targets" as empty arrays.
- For a "nutrition" plan leave "workouts" as an empty array.
- For a "combined" plan populate all of them.
- Only set fields that apply to the exercise's tracking configuration. A bodyweight
  movement should have a null weight; a timed hold should use timeSeconds, not reps.

How to program the training. These are not stylistic preferences; a plan that
ignores them is wrong:

1. Linear progression. Repeat a small set of main movements rather than rotating
   through new ones. Each time a movement recurs it goes up by one step and one
   step only - about 2.5 kg for upper body, 5 kg for lower body, or one to two
   reps where load cannot move. Never advance load and reps in the same session.
   If RECENT TRAINING shows a movement was already trained, continue from where it
   left off rather than restarting it.
2. Read the difficulty the user reported on recent sessions and size the step:
   - "easy": take the full step, and add a set to the main lift if the session
     length allows it.
   - "medium": take the full step. This is the plan working as intended.
   - "hard": hold the load flat and repeat it, or drop about 10% and build back.
     Do not add volume.
   - no answer recorded: take the full step.
   Two or more "hard" sessions in a row means the plan is too aggressive - cut one
   working set per movement across the whole plan.
3. Every set gets an explicit restSeconds. Never leave it null on a strength set.
   Heavy compound lifts get 120-180s, accessory work 60-90s, conditioning 30-45s.
4. Warm-up is part of the plan, not advice. Every training day opens with 5-10
   minutes of general work - light cardio and mobility taken from the catalogue -
   as its own first exercises. On top of that, every heavy compound lift carries
   "warmupSets": 1-3 ramp-up sets at a lighter load. warmupSets counts INTO
   "sets", never on top of it: two warm-up sets plus three working sets is
   "sets": 5 with "warmupSets": 2. Accessory and bodyweight work uses 0 or null.
5. Every training day closes with a cool-down: 2-4 stretching, mobility or
   flexibility movements from the catalogue, written as timed holds using
   timeSeconds, with low restSeconds and no load.
6. Order each day: warm-up, then the heaviest compound movement while the user is
   fresh, then accessories, then the cool-down.
7. Respect the stated session length. Sets multiplied by rest is most of a
   session's clock, so drop movements rather than cutting rest below the ranges
   above. Leave at least one rest day between sessions training the same muscle
   group.
8. Calibrate to the measured fitness level in USER PROFILE, when present — it is
   computed from real training history, not self-reported, so weight it over a
   stated goal that implies something different:
   - "beginner": simple movement patterns, conservative loads, more full-body
     sessions than splits, extra coaching detail in "notes".
   - "novice": a standard split is fine; keep the working-set count moderate
     while technique is still consolidating.
   - "intermediate": normal working-set volume, more exercise variety per
     movement pattern.
   - "advanced": the step sizes in rule 1 are a floor, not a ceiling — this
     person can absorb more volume and faster progression within them.
   No fitness level yet (a first plan, nothing completed): program as beginner.

Fixed identifiers. These are machine values, not text for the reader. Write them in
lowercase English exactly as listed, whatever language the rest of the plan is in:
- "kind" is one of: workout, nutrition, combined
- "slot" is one of: breakfast, lunch, dinner, snack
The app translates them for display, so translating them here breaks the plan.`;

const formatProfile = (context: AiRequestContext): string => {
    const { profile } = context;
    const lines: string[] = [];

    const push = (label: string, value: unknown) => {
        if (value === null || value === undefined) return;
        if (Array.isArray(value)) {
            if (value.length === 0) return;
            lines.push(`- ${label}: ${value.join(', ')}`);
            return;
        }
        if (typeof value === 'string' && value.trim().length === 0) return;
        lines.push(`- ${label}: ${value}`);
    };

    // Computed from real training history, not asked for — see
    // src/helpers/fitness-level.ts. Placed first: it is the single figure
    // that most changes how the rest of this profile should be read.
    push('Fitness level (measured from training history)', profile.fitnessLevel);
    push('Goal', profile.goal);
    push('Activity level', profile.activityLevel);
    push('Sessions per week', profile.sessionsPerWeek);
    push('Minutes per session', profile.sessionMinutes);
    push('Body weight (kg)', profile.bodyWeightKg);
    push('Height (cm)', profile.heightCm);
    push('Daily calorie target', profile.dailyCalorieTarget);
    push('Dietary pattern', profile.dietaryPattern);
    push('Allergens to avoid', profile.allergens);
    push('Declared conditions', profile.conditions);
    push('Available equipment', profile.equipment);
    push('Notes', profile.notes);

    if (lines.length === 0) {
        return 'The user has not filled in a profile yet. Ask for what you need, or make conservative general-population assumptions.';
    }

    return lines.join('\n');
};

const formatCandidates = (context: AiRequestContext): string => {
    if (context.candidates.length === 0) {
        return 'The exercise catalogue is empty. Tell the user to add exercises first.';
    }

    // Compact single-line-per-item encoding: markedly fewer tokens than JSON for the
    // same information, which matters because this is the bulk of the prompt.
    return context.candidates
        .map((candidate) => {
            const muscles = candidate.primaryMuscleGroups.join('/') || 'general';
            const equipment = candidate.equipment.join('/') || 'bodyweight';
            return `${candidate.id} | ${candidate.name} | ${candidate.category} | ${muscles} | ${equipment} | tracks:${candidate.tracking.join('+')}`;
        })
        .join('\n');
};

/**
 * Recent sessions, each tagged with how hard the user said it was.
 *
 * That answer is the point of this block for progression: it is the only signal
 * the app has about whether the last step was too big, and the system rules
 * above say what to do with each value.
 */
const formatHistory = (context: AiRequestContext): string => {
    if (context.history.length === 0) return 'No completed workouts yet.';

    return context.history
        .map((entry) => {
            const date = new Date(entry.completedAt).toISOString().slice(0, 10);
            const exercises = entry.exerciseNames.slice(0, 6).join(', ');
            const felt = entry.difficulty ? ` [felt: ${entry.difficulty}]` : '';
            return `- ${date} ${entry.name}: ${exercises}${felt}`;
        })
        .join('\n');
};

/**
 * Reviewed guidance for whatever conditions the user declared and retrieval
 * found a written row for. Absent (the pre-retrieval, and still the default,
 * state) whenever `context.guidance` is empty — a condition the user declared
 * with nothing authored yet, or no retrieval configured at all, is silently
 * absent from the prompt rather than rendered as an empty section.
 */
const formatGuidance = (context: AiRequestContext): string | null => {
    if (context.guidance.length === 0) return null;

    return context.guidance
        .map((entry) => `${entry.title} (${entry.condition}):\n${entry.body}`)
        .join('\n\n');
};

/**
 * The app ships five locales. The model has to be told which one to answer in —
 * left to itself it replies in the language of the prompt, which is English, so a
 * Hindi or Russian user would get an English plan inside a translated interface.
 */
const LANGUAGE_NAMES: Record<string, string> = {
    en: 'English',
    es: 'Spanish (Español)',
    hi: 'Hindi (हिन्दी)',
    ru: 'Russian (Русский)',
    zh: 'Chinese (中文)',
};

export const resolveLanguageName = (locale: string): string => {
    const base = locale.toLowerCase().split(/[-_]/)[0];
    return LANGUAGE_NAMES[base] ?? LANGUAGE_NAMES.en;
};

/**
 * A nutrition-only plan never references an exercise, so shipping the catalogue costs
 * roughly 1,500 input tokens for nothing and invites the model to pad the answer with
 * training it was not asked for.
 */
const buildContextBlock = (
    context: AiRequestContext,
    { includeCatalogue = true }: { includeCatalogue?: boolean } = {},
): string => {
    const sections = [`USER PROFILE\n${formatProfile(context)}`];

    const guidance = formatGuidance(context);
    if (guidance) sections.push(`CONDITION GUIDANCE\n${guidance}`);

    if (includeCatalogue) {
        sections.push(`RECENT TRAINING\n${formatHistory(context)}`);
        sections.push(
            `EXERCISE CATALOGUE (id | name | category | muscles | equipment | tracking)\n${formatCandidates(context)}`,
        );
    }

    sections.push(`Weight unit: ${context.weightUnit}`);

    sections.push(
        `LANGUAGE
Write every word the user will read in ${resolveLanguageName(context.locale)}.
This covers plan titles, summaries, workout names, focus labels, exercise notes, and
food names.${
            includeCatalogue
                ? ' Exercise names come from the catalogue above and stay exactly as written there, because they are matched by id.'
                : ''
        }
JSON keys and the fixed identifiers listed above stay in lowercase English.`,
    );

    return sections.join('\n\n');
};

export const buildChatMessages = (
    context: AiRequestContext,
    history: AiChatMessage[],
    prompt: string,
): AiChatMessage[] => [
    { role: 'system', content: CHAT_SYSTEM },
    { role: 'system', content: buildContextBlock(context) },
    ...history,
    { role: 'user', content: prompt },
];

export const buildPlanMessages = (
    context: AiRequestContext,
    kind: AiPlanKind,
    intent: string,
    horizonDays: number,
    /**
     * Turns already in this conversation, so a question Syn asked and the
     * user's reply to it are visible when this is called again — without this
     * the assessment in `ASSESSMENT_SCHEMA_HINT` has nothing to check an
     * answer against and would ask the same question forever. Empty for the
     * first attempt in a conversation, same as `buildChatMessages` passes for
     * its own first turn.
     */
    priorHistory: AiChatMessage[] = [],
    /**
     * Set once the intake has already asked its share of questions this
     * conversation — see `INTAKE_QUESTION_LIMIT` in src/hooks/use-ai.tsx.
     * Tells the model to stop assessing and generate under conservative
     * assumptions instead, which is what keeps a user who never answers from
     * being asked a fourth time.
     */
    forceReady = false,
): AiChatMessage[] => {
    const ask =
        kind === 'nutrition'
            ? `Generate a ${horizonDays}-day nutrition plan.`
            : kind === 'workout'
              ? `Generate a ${horizonDays}-day training plan.`
              : `Generate a ${horizonDays}-day training and nutrition plan.`;

    // A day of meals is far wordier than a day of training, so a full week of food
    // runs into the output ceiling unless the shape is bounded up front. Truncated
    // JSON is unrecoverable; a slightly terser plan is not.
    const budget =
        kind === 'workout'
            ? ''
            : `\n\nKeep it tight so the JSON finishes: at most 4 meals per day and 3 items
per meal, short food names, no commentary beyond a one-line summary.`;

    const forceReadyLine = forceReady
        ? '\n\nFORCE_READY: this conversation has already asked what it needs to. Do not ask again — generate the plan now under conservative assumptions for anything still unknown.'
        : '';

    return [
        { role: 'system', content: PLAN_SYSTEM },
        {
            role: 'system',
            content: buildContextBlock(context, { includeCatalogue: kind !== 'nutrition' }),
        },
        ...priorHistory,
        {
            role: 'user',
            content: `${ask}\n\nWhat I want: ${intent}\n\nSet "kind" to "${kind}".${budget}${forceReadyLine}`,
        },
    ];
};
