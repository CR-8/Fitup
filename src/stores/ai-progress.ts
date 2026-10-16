import { create } from 'zustand';

/**
 * Where a plan generation really is, so the onboarding checklist can follow it
 * instead of a timer. Set by `generatePlan` in `use-ai.tsx` at the moments each
 * thing finishes, and cancelled through the controller it hands out.
 */
export type GenerationStage = 'idle' | 'context' | 'request' | 'validate' | 'save' | 'done';

export const GENERATION_STAGES: readonly GenerationStage[] = [
    'context',
    'request',
    'validate',
    'save',
];

type State = {
    stage: GenerationStage;
    controller: AbortController | null;
    /** Whether the last generation was cancelled by the person rather than finishing or failing. */
    cancelled: boolean;
    /** Starts a generation and returns the signal its request should carry. */
    begin: () => AbortSignal;
    setStage: (stage: GenerationStage) => void;
    finish: () => void;
    cancel: () => void;
};

export const useAiProgressStore = create<State>()((set, get) => ({
    stage: 'idle',
    controller: null,
    cancelled: false,
    begin: () => {
        const controller = new AbortController();
        set({ stage: 'context', controller, cancelled: false });

        return controller.signal;
    },
    setStage: (stage) => set({ stage }),
    finish: () => set({ stage: 'idle', controller: null }),
    cancel: () => {
        get().controller?.abort();
        set({ stage: 'idle', controller: null, cancelled: true });
    },
}));
