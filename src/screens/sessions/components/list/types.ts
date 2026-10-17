import type { ReactNode } from 'react';

import type { MonthGroup } from '../../data';

export interface SessionListProps {
    /** The screen's header: the native bar's title on iOS, drawn on Android. */
    header: ReactNode;
    chips: { key: string; label: string }[];
    selected: string;
    onSelect: (key: string) => void;
    groups: MonthGroup[];
    labels: {
        empty: string;
        delete: string;
        total: string;
        average: string;
        workouts: string;
        time: string;
        kcal: string;
    };
    onOpen: (id: string) => void;
    onDelete: (id: string) => void;
}

/** A session's duration; the month's time; the month's calories. */
export const SESSION_COLORS = {
    duration: '#D6F25A',
    time: '#FFD60A',
    kcal: '#FF375F',
};
