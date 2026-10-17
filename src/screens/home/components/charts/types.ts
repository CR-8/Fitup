export interface PeriodPickerProps {
    labels: string[];
    index: number;
    onChange: (index: number) => void;
}

export interface BarsProps {
    data: number[];
    /** The bucket we are in now, drawn solid; -1 draws every bucket solid. */
    current: number;
    color: string;
}

export interface AxisBarsProps {
    data: number[];
    /** Each bar's x: a category the axis names, or a number it spaces out (iOS). */
    x: (string | number)[];
    /** The x labels Android draws, by bar; '' leaves a bar unlabelled. */
    ticks: string[];
    color: string;
}

export interface LineProps {
    data: number[];
    color: string;
}

export interface RingProps {
    /** 0–1; anything past 1 shows as a full ring. */
    progress: number;
    color: string;
    size: number;
}

export interface MetricProps {
    value: string;
    unit?: string;
    color: string;
    size?: number;
}
