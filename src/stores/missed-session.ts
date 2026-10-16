import { create } from 'zustand';

/** The planned workout whose "You missed a session" sheet is open, if any. */
type State = { workoutId?: string };
type Actions = { open: (workoutId: string) => void; close: () => void };

export const useMissedSessionStore = create<State & Actions>()((set) => ({
    open: (workoutId) => set({ workoutId }),
    close: () => set({ workoutId: undefined }),
}));
