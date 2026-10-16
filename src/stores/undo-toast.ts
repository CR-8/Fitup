import { create } from 'zustand';

export type UndoToast = { id: number; message: string; onUndo: () => void };

let nextId = 1;

/** One undoable action at a time: a new one replaces the last. */
export const useUndoToastStore = create<{
    toast?: UndoToast;
    show: (message: string, onUndo: () => void) => void;
    dismiss: () => void;
}>()((set) => ({
    show: (message, onUndo) => set({ toast: { id: nextId++, message, onUndo } }),
    dismiss: () => set({ toast: undefined }),
}));
