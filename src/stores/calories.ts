import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { storage } from '@/storage';

/**
 * The calorie ring's detail screen: which day it shows (the week strip and the
 * calendar sheet both set it), and goals adjusted for a single day ("Adjust
 * Goal for Today"), kept on the device by `YYYY-MM-DD`. The daily goal itself
 * is the profile's `dailyCalorieTarget`.
 */
export const useCaloriesStore = create<{
    day: string;
    setDay: (day: string) => void;
    overrides: Record<string, number>;
    setOverride: (day: string, kcal: number) => void;
}>()(
    persist(
        (set) => ({
            day: '',
            setDay: (day) => set({ day }),
            overrides: {},
            setOverride: (day, kcal) =>
                set((state) => ({ overrides: { ...state.overrides, [day]: kcal } })),
        }),
        {
            name: 'calorie-goals',
            storage: createJSONStorage(() => ({
                getItem: (key) => storage.getString(key) ?? null,
                setItem: (key, value) => storage.set(key, value),
                removeItem: (key) => {
                    storage.remove(key);
                },
            })),
            partialize: (state) => ({ overrides: state.overrides }),
        },
    ),
);
