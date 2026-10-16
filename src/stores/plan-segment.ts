import { create } from 'zustand';

export type PlanSegment = 'week' | 'library';

/**
 * Which half of the Plan tab is showing. A store rather than screen state
 * because the navigation header owns the control and the header's trailing
 * button (create vs. filter) follows it, and both live outside the screen.
 */
export const usePlanSegmentStore = create<{
    segment: PlanSegment;
    setSegment: (segment: PlanSegment) => void;
}>()((set) => ({
    segment: 'week',
    setSegment: (segment) => set({ segment }),
}));
