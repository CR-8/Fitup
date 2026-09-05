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
export const PROMPT_VERSION = '1';

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

${PLAN_SCHEMA_HINT}

Rules for the payload:
- dayOffset is zero-based: 0 is the first day of the plan.
- For a "workout" plan leave "meals" and "targets" as empty arrays.
- For a "nutrition" plan leave "workouts" as an empty array.
- For a "combined" plan populate all of them.
- Only set fields that apply to the exercise's tracking configuration. A bodyweight
  movement should have a null weight; a timed hold should use timeSeconds, not reps.

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

const formatHistory = (context: AiRequestContext): string => {
    if (context.history.length === 0) return 'No completed workouts yet.';

    return context.history
        .map((entry) => {
            const date = new Date(entry.completedAt).toISOString().slice(0, 10);
            const exercises = entry.exerciseNames.slice(0, 6).join(', ');
            return `- ${date} ${entry.name}: ${exercises}`;
        })
        .join('\n');
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

    return [
        { role: 'system', content: PLAN_SYSTEM },
        {
            role: 'system',
            content: buildContextBlock(context, { includeCatalogue: kind !== 'nutrition' }),
        },
        {
            role: 'user',
            content: `${ask}\n\nWhat I want: ${intent}\n\nSet "kind" to "${kind}".${budget}`,
        },
    ];
};
