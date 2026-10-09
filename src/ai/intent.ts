import type { AiPlanKind } from '@/constants/ai';

/**
 * Whether something typed into the AI tab is asking for a plan.
 *
 * Before this, everything typed went to plain chat, whose instructions told the
 * model to send people back to the plan buttons. So "make me a 4 day split"
 * was answered with "use the buttons", and a reply to one of Syn's questions
 * never produced the plan it was asked for — the conversation felt like a form
 * that would not accept answers.
 *
 * Deliberately a small keyword match, not another model call: it runs on every
 * send and must not cost a second round trip. It errs towards chat, because the
 * two mistakes are not equal — a request it misses still reaches chat, which
 * tells the user how to ask, but a remark it mistakes for a request spends one
 * of the month's plans. People type the way they text, in English or Hinglish,
 * so both are matched.
 */

export interface PlanRequest {
    kind: AiPlanKind;
    /** Changing the running plan rather than asking for a fresh one. */
    revision: boolean;
}

/** Something a plan is made of. */
const PLAN_NOUN =
    /\b(plan|plans|routine|program|programme|split|schedule|regime|regimen|ppl|full[\s-]?body|upper[\s/-]?lower|push[\s/-]?pull|workouts? for|workouts? plan|week of (training|workouts?))\b/i;

/** Asking for one to be made. */
const MAKE_VERB =
    /\b(make|build|create|give|generate|design|write|draft|set ?up|plan out|need|want|get me|suggest|new|another|start|redo|rebuild|bana(o|do|na|iye)?|chahiye|de ?do)\b/i;

/**
 * "4 day split", "3x a week plan": a schedule shape naming a plan is a request
 * on its own. "I train 3 days a week" is not — it names no plan.
 */
const SCHEDULE_SHAPE = /\b\d\s*(x|days?|times)\b.*\b(split|plan|routine|program|programme)\b/i;

/**
 * Changing what is already running. Only counts when there is a plan to change,
 * and only as an instruction — said first ("swap squats for lunges"), or about
 * the plan ("make it harder") — so "my knees hurt when I change direction" is
 * conversation, not a rewrite.
 */
const REVISE_VERB =
    /\b(harder|easier|tougher|lighter|heavier|more (sets|volume|reps|cardio|days)|less (sets|volume|reps|cardio|days)|fewer|swap|replace|change|adjust|tweak|modify|update|switch|redo|rebuild|different exercises|add (cardio|abs|core|legs|arms|food|meals|nutrition|a day|days)|remove|drop|badlo|badal)\b/i;

const IMPERATIVE_START =
    /^\s*(please\s+|pls\s+|can you\s+|could you\s+)?(make|swap|replace|change|adjust|tweak|modify|update|switch|redo|rebuild|add|remove|drop|more|less|fewer|harder|easier)\b/i;
const ABOUT_THE_PLAN =
    /\b(it|plan|routine|program|programme|split|schedule|my (workouts?|week|sessions?))\b/i;

/** Asking for food as a plan, not just mentioning eating. */
const FOOD_PLAN =
    /\b(diet|diet chart|diet plan|meal plan|meals|food chart|food plan|nutrition plan|khana)\b/i;

/** "I don't want a new plan" is not a request for one. */
const NEGATION = /\b(don'?t|do not|doesn'?t|no need|not now|never mind|nahi|mat)\b/i;

/** Food words decide the plan kind. */
const FOOD =
    /\b(diet|meal|meals|food|foods|nutrition|calorie|calories|macro|macros|eat|eating|khana|protein intake)\b/i;
const TRAINING =
    /\b(workout|workouts|training|train|exercise|exercises|gym|split|routine|program|programme|lift|lifting|cardio|strength|ppl|full[\s-]?body|sets|reps)\b/i;

/** A question about something, rather than a request for it. */
const QUESTION_START =
    /^\s*(what|why|how|when|where|who|which|is|are|does|do|did|should|would|could|can i|will|explain|tell me about|kya|kyun|kaise)\b/i;

export const detectPlanRequest = (
    text: string,
    { hasActivePlan = false }: { hasActivePlan?: boolean } = {},
): PlanRequest | null => {
    const message = text.trim();
    if (message.length === 0 || NEGATION.test(message)) return null;

    const hasPlanNoun = PLAN_NOUN.test(message);
    const hasMakeVerb = MAKE_VERB.test(message);
    const isQuestion = QUESTION_START.test(message) && !hasMakeVerb;

    const wantsFood = FOOD.test(message);
    // "Plan" on its own says nothing about what kind: a "meal plan" is food.
    const wantsTraining =
        TRAINING.test(message) || SCHEDULE_SHAPE.test(message) || (hasPlanNoun && !wantsFood);

    const kind: AiPlanKind =
        wantsFood && wantsTraining ? 'combined' : wantsFood ? 'nutrition' : 'workout';

    if (isQuestion) return null;

    // Checked first: "make my plan easier" has the words of a new-plan request
    // too, but with a plan running it means change this one.
    const isInstruction = IMPERATIVE_START.test(message) || ABOUT_THE_PLAN.test(message);
    const asksForFresh = /\b(new|another|fresh)\b/i.test(message);

    if (hasActivePlan && !asksForFresh && isInstruction && REVISE_VERB.test(message)) {
        // Adding food to a training plan keeps the training.
        return { kind: wantsFood && !wantsTraining ? 'combined' : kind, revision: true };
    }

    if ((hasPlanNoun || FOOD_PLAN.test(message)) && hasMakeVerb) {
        return { kind, revision: false };
    }

    if (SCHEDULE_SHAPE.test(message)) {
        return { kind, revision: false };
    }

    return null;
};
