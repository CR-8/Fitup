import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { storage } from '@/storage';

/**
 * Which cards Today shows, in what order, after Apple Fitness's customizable
 * Summary; and whether its "A Customizable Summary" intro has been dismissed.
 * Kept on this device.
 */

export const SUMMARY_CARDS = [
    'workout',
    'water',
    'distance',
    'sessions',
    'progress',
    'calories',
    'awards',
] as const;
export type SummaryCard = (typeof SUMMARY_CARDS)[number];

/** Half-width cards: two side by side make a row; one alone takes the width. */
export const HALF_CARDS: ReadonlySet<SummaryCard> = new Set(['water', 'distance']);

interface SummaryLayoutState {
    cards: SummaryCard[];
    introDismissed: boolean;
    add: (card: SummaryCard) => void;
    remove: (card: SummaryCard) => void;
    move: (card: SummaryCard, by: -1 | 1) => void;
    dismissIntro: () => void;
}

export const useSummaryLayout = create<SummaryLayoutState>()(
    persist(
        (set) => ({
            cards: [...SUMMARY_CARDS],
            introDismissed: false,
            add: (card) =>
                set((state) =>
                    state.cards.includes(card) ? state : { cards: [...state.cards, card] },
                ),
            remove: (card) => set((state) => ({ cards: state.cards.filter((c) => c !== card) })),
            move: (card, by) =>
                set((state) => {
                    const from = state.cards.indexOf(card);
                    const to = from + by;
                    if (from < 0 || to < 0 || to >= state.cards.length) return state;
                    const cards = [...state.cards];
                    [cards[from], cards[to]] = [cards[to], cards[from]];
                    return { cards };
                }),
            dismissIntro: () => set({ introDismissed: true }),
        }),
        {
            name: 'summary-layout',
            storage: createJSONStorage(() => ({
                getItem: (key) => storage.getString(key) ?? null,
                setItem: (key, value) => storage.set(key, value),
                removeItem: (key) => {
                    storage.remove(key);
                },
            })),
            // A card this build no longer knows is dropped rather than rendered as nothing.
            merge: (persisted, current) => {
                const saved = (persisted ?? {}) as Partial<SummaryLayoutState>;
                return {
                    ...current,
                    ...saved,
                    cards: (saved.cards ?? current.cards).filter((card) =>
                        (SUMMARY_CARDS as readonly string[]).includes(card),
                    ),
                };
            },
        },
    ),
);

/** The visible cards as rows: consecutive half-width cards share one. */
export const toRows = (cards: SummaryCard[]): SummaryCard[][] => {
    const rows: SummaryCard[][] = [];
    for (const card of cards) {
        const last = rows[rows.length - 1];
        if (HALF_CARDS.has(card) && last?.length === 1 && HALF_CARDS.has(last[0])) last.push(card);
        else rows.push([card]);
    }
    return rows;
};
