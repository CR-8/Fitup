import { create } from 'zustand';

/** Text waiting in Syn's composer, e.g. when a plan preview sends you back to ask for changes. */
export const useSynDraftStore = create<{
    draft: string;
    setDraft: (draft: string) => void;
}>()((set) => ({
    draft: '',
    setDraft: (draft) => set({ draft }),
}));
