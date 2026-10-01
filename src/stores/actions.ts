import { create } from 'zustand';

/**
 * The one sheet still opened from anywhere: how hard a workout felt, asked once
 * as it is ended. Every other action is a native menu on its own button.
 */
type WorkoutFeedback = {
    type: 'workout__feedback';
    title?: string;
    showCloseButton?: boolean;
    payload: {
        workoutId: string;
    };
};

type State = {
    type?: WorkoutFeedback['type'];
    title?: string;
    payload?: WorkoutFeedback['payload'];
};

type Actions = {
    open: (props: WorkoutFeedback) => void;
    close: () => void;
};

export const useActionsStore = create<State & Actions>()((set) => ({
    open: ({ type, title, payload }) => set({ type, title, payload }),
    close: () => set({ type: undefined, title: undefined, payload: undefined }),
}));
