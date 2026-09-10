/**
 * A deterministic read of how far along someone's training is.
 *
 * Not a model judgement. Syn's plans get better with a true starting point —
 * a novice programmed like they are three years in gets hurt or discouraged,
 * an advanced lifter programmed like week one gets nothing out of a session —
 * and a number a language model estimates from a paragraph of chat is neither
 * stable across a conversation nor reproducible. This is arithmetic over rows
 * the app already has, so the same training history always resolves to the
 * same level, and the level only ever moves because the training did.
 *
 * Two signals, weighted differently on purpose:
 *
 *   - Training age and adherence — how many distinct weeks include a
 *     completed workout, and how many sessions per week that averages to.
 *     This is the input every user has from their first completed workout
 *     onward, and it is the single most defensible proxy available without
 *     real physiological data: adaptation to resistance training is far more
 *     a function of consistent time under load than of any other easily
 *     observed figure.
 *   - Relative strength — an estimated one-rep max against body weight,
 *     when a caller has one to supply. Optional, because nothing in this
 *     app aggregates it across the whole catalogue in one query today (see
 *     `bestRelativeStrength` below) — the function resolves correctly from
 *     training age alone until that exists. When present, it can move the
 *     result a level in either direction: it is a real measured outcome, and
 *     a genuinely strong newcomer or a long-tenured but stalled lifter are
 *     both real cases training age alone gets wrong.
 *
 * Explicitly NOT an input: `computeStreakDays` (src/helpers/workouts.ts). A
 * day-over-day streak rewards training without rest days, which is the
 * opposite of what sound programming looks like — a lifter alternating hard
 * sessions with rest days will show a short, constantly-resetting streak next
 * to someone doing a short walk daily, and reading that as "more advanced"
 * would be backwards. Streak stays what it already is: a motivational figure
 * on Home, not a competency signal here.
 */

export type FitnessLevel = 'beginner' | 'novice' | 'intermediate' | 'advanced';

export interface FitnessLevelInput {
    /** Total completed workouts, all time. */
    workoutsCount: number;
    /** Distinct weeks that include at least one completed workout, all time. */
    trainingWeeks: number;
    /**
     * Best (estimated 1RM in kg) / (body weight in kg) across the user's
     * tracked compound lifts, when a caller has computed one. `null` when
     * there is no bodyweight on file or no qualifying lift has been logged;
     * `undefined` when the caller has not built this query at all. Both
     * resolve identically here — training age alone decides the level.
     */
    bestRelativeStrength?: number | null;
}

/**
 * Weeks of consistent training before adaptation typically moves someone past
 * "just started" and into visible, repeatable progress. Deliberately rough —
 * this is a heuristic threshold, not a citation, and it is why every boundary
 * here is a named constant rather than a number inline: the values are easy
 * to find and easy to argue with, on purpose.
 */
const NOVICE_WEEKS = 6;
const INTERMEDIATE_WEEKS = 26;
const ADVANCED_WEEKS = 104;

/** Below this, sessions are too sparse to call the weeks above "training" rather than "trying". */
const MIN_SESSIONS_PER_WEEK = 1.5;

/**
 * Rough relative-strength bands (estimated 1RM ÷ body weight), from the big
 * compound lifts general strength-standards tables converge on for an
 * untrained-to-advanced range. Applied to whichever single lift a caller's
 * `bestRelativeStrength` came from — it is a coarse signal by nature, used
 * only to nudge a training-age estimate, never to set the level by itself.
 */
const NOVICE_RELATIVE_STRENGTH = 0.75;
const INTERMEDIATE_RELATIVE_STRENGTH = 1.25;
const ADVANCED_RELATIVE_STRENGTH = 1.75;

const LEVELS: readonly FitnessLevel[] = ['beginner', 'novice', 'intermediate', 'advanced'];

const levelFromTrainingAge = (workoutsCount: number, trainingWeeks: number): FitnessLevel => {
    if (workoutsCount === 0 || trainingWeeks === 0) return 'beginner';

    const sessionsPerWeek = workoutsCount / trainingWeeks;
    if (sessionsPerWeek < MIN_SESSIONS_PER_WEEK) return 'beginner';

    if (trainingWeeks >= ADVANCED_WEEKS) return 'advanced';
    if (trainingWeeks >= INTERMEDIATE_WEEKS) return 'intermediate';
    if (trainingWeeks >= NOVICE_WEEKS) return 'novice';
    return 'beginner';
};

const levelFromRelativeStrength = (ratio: number): FitnessLevel => {
    if (ratio >= ADVANCED_RELATIVE_STRENGTH) return 'advanced';
    if (ratio >= INTERMEDIATE_RELATIVE_STRENGTH) return 'intermediate';
    if (ratio >= NOVICE_RELATIVE_STRENGTH) return 'novice';
    return 'beginner';
};

/**
 * Resolves a level from training age, then lets a real relative-strength
 * reading move it — by at most one step in either direction. A single lift's
 * ratio is too coarse a signal to leap two levels past what months of actual
 * training history says, but it is a real outcome and deserves more than
 * being ignored when training age alone disagrees with it.
 */
export const resolveFitnessLevel = (input: FitnessLevelInput): FitnessLevel => {
    const base = levelFromTrainingAge(input.workoutsCount, input.trainingWeeks);

    if (input.bestRelativeStrength == null || !Number.isFinite(input.bestRelativeStrength)) {
        return base;
    }

    const fromStrength = levelFromRelativeStrength(input.bestRelativeStrength);
    const baseIndex = LEVELS.indexOf(base);
    const strengthIndex = LEVELS.indexOf(fromStrength);
    const clampedIndex = Math.min(baseIndex + 1, Math.max(baseIndex - 1, strengthIndex));

    return LEVELS[clampedIndex];
};
