/**
 * Which greeting the hour calls for.
 *
 * Boundaries chosen to be unsurprising rather than astronomically correct.
 * Separate from the component so it carries no native imports.
 */
export type SalutationKey = 'morning' | 'afternoon' | 'evening';

export const greetingKeyForHour = (hour: number): SalutationKey => {
    if (hour < 12) return 'morning';
    if (hour < 18) return 'afternoon';

    return 'evening';
};
