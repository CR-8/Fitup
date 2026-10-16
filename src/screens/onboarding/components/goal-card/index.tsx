import { FC } from 'react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { HStack } from '@/components/primitives/hstack';
import { VStack } from '@/components/primitives/vstack';
import { Text } from '@/components/primitives/text';
import { Pressable } from '@/components/primitives/pressable';
import { Icon, type IconName } from '@/components/primitives/icon';

const styles = StyleSheet.create((theme) => ({
    card: (selected: boolean) => ({
        alignItems: 'center',
        gap: theme.space(3),
        minHeight: theme.space(16),
        backgroundColor: selected ? theme.colors.elevated : theme.colors.foreground,
        borderRadius: theme.radius['2xl'],
        borderCurve: 'continuous' as const,
        borderWidth: selected ? 1.5 : 1,
        borderColor: selected ? theme.colors.brand[500] : theme.colors.border,
        paddingHorizontal: theme.space(4),
        paddingVertical: theme.space(3),
    }),
    text: {
        flex: 1,
        gap: theme.space(0.5),
    },
    title: {
        ...theme.fontSize.default,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: theme.colors.typography,
    },
    hint: {
        ...theme.fontSize.sm,
        color: theme.colors.mutedTypography,
    },
}));

type GoalCardProps = {
    icon: IconName;
    title: string;
    hint: string;
    selected: boolean;
    onPress: () => void;
};

/** A single-choice card: grey outline icon, red only once it is the one chosen. */
export const GoalCard: FC<GoalCardProps> = ({ icon, title, hint, selected, onPress }) => {
    const { theme } = useUnistyles();

    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={`${title}. ${hint}`}
        >
            <HStack style={styles.card(selected)}>
                <Icon
                    name={icon}
                    size={theme.space(6)}
                    color={selected ? theme.colors.brand[500] : theme.colors.mutedTypography}
                />
                <VStack style={styles.text}>
                    <Text style={styles.title}>{title}</Text>
                    <Text style={styles.hint}>{hint}</Text>
                </VStack>
                {selected ? (
                    <Icon
                        name="check-circle"
                        size={theme.space(6)}
                        color={theme.colors.brand[500]}
                    />
                ) : null}
            </HStack>
        </Pressable>
    );
};
