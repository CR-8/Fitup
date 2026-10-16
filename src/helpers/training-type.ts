/**
 * The kind of training a session is, for the small coloured dots in Plan and
 * Progress. Derived from the session's dominant muscle group rather than stored:
 * the same session can be filed differently as the muscle map is refined.
 */
export type TrainingType = 'push' | 'pull' | 'legs' | 'core' | 'mobility';

const BY_MUSCLE: Record<string, TrainingType> = {
    chest: 'push',
    shoulders: 'push',
    back: 'pull',
    // Arms span biceps (pull) and triceps (push); pull is the more common pairing
    // for a session whose lead muscle is "arms".
    arms: 'pull',
    legs: 'legs',
    abs: 'core',
};

export const getTrainingType = (primaryMuscleGroups: readonly string[] | undefined): TrainingType =>
    BY_MUSCLE[primaryMuscleGroups?.[0] ?? ''] ?? 'mobility';
