import { Host, Picker, Text } from '@expo/ui/swift-ui';
import { accessibilityLabel as label, pickerStyle, tag, tint } from '@expo/ui/swift-ui/modifiers';

import type { MenuPickerProps } from './types';

/** "30min ⌃": a native SwiftUI menu picker. Android draws its own (`index.android.tsx`). */
export function MenuPicker<T extends string | number>({
    value,
    options,
    onChange,
    accessibilityLabel,
    color = '#9a9fa8',
}: MenuPickerProps<T>) {
    return (
        <Host matchContents>
            <Picker
                selection={value}
                onSelectionChange={(selection) => onChange(selection as T)}
                modifiers={[pickerStyle('menu'), tint(color), label(accessibilityLabel)]}
            >
                {options.map((option) => (
                    <Text key={String(option.value)} modifiers={[tag(option.value)]}>
                        {option.label}
                    </Text>
                ))}
            </Picker>
        </Host>
    );
}
