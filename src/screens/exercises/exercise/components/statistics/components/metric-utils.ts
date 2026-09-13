import type { ExerciseHistoryItem } from '@/crud/exercise';

export interface MetricChartPoint {
    id: string;
    value: number;
    date: Date;
    label: string;
}

/**
 * Epley-family estimate, shared so the three places that estimate a 1RM
 * (this exercise's history chart, a workout's live exercise stats, and the
 * timer's personal-best check) can't quietly drift apart from each other.
 */
export const estimateOneRm = (weight: number, reps: number): number => weight * (1 + reps / 30);

export const roundOneDecimal = (value: number): number => Math.round(value * 10) / 10;

export const roundTwoDecimals = (value: number): number => Math.round(value * 100) / 100;

export const isWeightUnit = (value: string): value is 'kg' | 'lb' =>
    value === 'kg' || value === 'lb';

export const resolveWorkoutDate = (historyItem: ExerciseHistoryItem): Date => {
    return (
        historyItem.workout.completedAt ??
        historyItem.workout.startedAt ??
        historyItem.workout.createdAt
    );
};

export const sortMetricPoints = <T extends MetricChartPoint>(points: T[]): T[] => {
    return points.sort((a, b) => {
        const timeDiff = a.date.getTime() - b.date.getTime();
        if (timeDiff !== 0) return timeDiff;
        return a.id.localeCompare(b.id);
    });
};
