export interface MenuPickerProps<T extends string | number> {
    value: T;
    options: { value: T; label: string }[];
    onChange: (value: T) => void;
    /** Read out by screen readers; the button itself shows the current choice. */
    accessibilityLabel: string;
    color?: string;
}
