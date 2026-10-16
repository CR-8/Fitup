import { StyleSheet } from 'react-native-unistyles';

import { HStack } from '@/components/primitives/hstack';
import { Pressable } from '@/components/primitives/pressable';
import { Text } from '@/components/primitives/text';

type SegmentedTabsProps<T extends string> = {
    segments: readonly { value: T; title: string }[];
    value: T;
    onChange: (value: T) => void;
    accessibilityLabel?: string;
    /** Narrower, for sitting beside a field. */
    compact?: boolean;
};

const styles = StyleSheet.create((theme) => ({
    container: {
        backgroundColor: theme.colors.elevated,
        borderRadius: theme.radius.xl,
        padding: theme.space(0.75),
        gap: theme.space(0.75),
    },
    segment: (selected: boolean, compact: boolean) => ({
        minWidth: theme.space(compact ? 12 : 20),
        height: theme.space(8),
        paddingHorizontal: theme.space(3),
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: theme.radius.lg,
        backgroundColor: selected ? theme.colors.brand[600] : 'transparent',
    }),
    title: (selected: boolean) => ({
        ...theme.fontSize.sm,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: selected ? theme.colors.primaryTypography : theme.colors.mutedTypography,
    }),
}));

/** A pill of two to four options, the selected one filled. Same on both platforms. */
export function SegmentedTabs<T extends string>({
    segments,
    value,
    onChange,
    accessibilityLabel,
    compact = false,
}: SegmentedTabsProps<T>) {
    return (
        <HStack
            style={styles.container}
            accessibilityRole="tablist"
            accessibilityLabel={accessibilityLabel}
        >
            {segments.map((segment) => {
                const selected = segment.value === value;

                return (
                    <Pressable
                        key={segment.value}
                        style={styles.segment(selected, compact)}
                        onPress={() => onChange(segment.value)}
                        accessibilityRole="tab"
                        accessibilityState={{ selected }}
                    >
                        <Text style={styles.title(selected)}>{segment.title}</Text>
                    </Pressable>
                );
            })}
        </HStack>
    );
}
