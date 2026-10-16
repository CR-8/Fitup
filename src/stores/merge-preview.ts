import { create } from 'zustand';

/** The plan whose "Preview changes" sheet is open, if any. */
export const useMergePreviewStore = create<{
    planId?: string;
    open: (planId: string) => void;
    close: () => void;
}>()((set) => ({
    open: (planId) => set({ planId }),
    close: () => set({ planId: undefined }),
}));
