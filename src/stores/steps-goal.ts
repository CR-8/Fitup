import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { storage } from '@/storage';

export const DEFAULT_STEPS_GOAL = 10000;

/**
 * The daily steps goal the dial's steps ring fills against, set in onboarding
 * and kept on the device.
 */
export const useStepsGoalStore = create<{ goal: number; setGoal: (goal: number) => void }>()(
    persist(
        (set) => ({
            goal: DEFAULT_STEPS_GOAL,
            setGoal: (goal) => set({ goal }),
        }),
        {
            name: 'steps-goal',
            storage: createJSONStorage(() => ({
                getItem: (key) => storage.getString(key) ?? null,
                setItem: (key, value) => storage.set(key, value),
                removeItem: (key) => {
                    storage.remove(key);
                },
            })),
        },
    ),
);
