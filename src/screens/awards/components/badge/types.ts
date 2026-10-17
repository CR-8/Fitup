import type { AwardShape, AwardSymbol } from '../../data';

export interface BadgeProps {
    shape: AwardShape;
    symbol: AwardSymbol;
    color: string;
    /** Earned badges take their colour; the rest are grey line art. */
    earned: boolean;
    size: number;
}

export interface ProgressLineProps {
    /** 0–1. */
    progress: number;
    color: string;
}

/** Line art for a badge not yet earned. */
export const UNEARNED = '#4b5059';
