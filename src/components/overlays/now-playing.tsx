import { FC } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { router } from 'expo-router';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';

import { Box } from '@/components/primitives/box';
import { FrostedGlass } from '@/components/primitives/frosted-glass';
import { HStack } from '@/components/primitives/hstack';
import { Icon } from '@/components/primitives/icon';
import { Pressable } from '@/components/primitives/pressable';
import { Text } from '@/components/primitives/text';
import { VStack } from '@/components/primitives/vstack';
import { useRunningWorkoutStatic, useRunningWorkoutTicker } from '@/hooks/use-running-workout';
import { ACCENT } from '@/screens/home/summary';

/**
 * The workout under way, like a music app's now-playing bar: its name and
 * clock, and a tap back into the timer. Nothing when no workout is running.
 * iOS shows the row in the tab bar's bottom accessory; Android floats it in a
 * glass pill above its own tab bar.
 */

const LIME = ACCENT.distance;

const styles = StyleSheet.create((theme, rt) => ({
    pill: {
        position: 'absolute',
        left: theme.space(5),
        right: theme.space(5),
        bottom: rt.insets.bottom + theme.space(2),
        borderRadius: theme.radius.full,
    },
    row: (compact: boolean) => ({
        minHeight: compact ? 0 : 60,
        alignItems: 'center',
        gap: theme.space(3),
        paddingLeft: theme.space(2),
        paddingRight: theme.space(4),
    }),
    dot: (compact: boolean) => ({
        height: compact ? 32 : 44,
        width: compact ? 32 : 44,
        borderRadius: theme.radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: `${LIME}26`,
    }),
    text: {
        flex: 1,
    },
    eyebrow: {
        ...theme.fontSize.xs,
        color: theme.colors.mutedTypography,
    },
    name: {
        ...theme.fontSize.default,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: theme.colors.typography,
    },
    clock: {
        fontSize: 20,
        lineHeight: 24,
        color: LIME,
        ...theme.typography.metric,
    },
}));

/** The row alone, for a surface that draws its own glass (iOS's bottom accessory). */
export const NowPlayingRow: FC<{ compact?: boolean }> = ({ compact = false }) => {
    const { t } = useTranslation(['screens']);
    const { theme } = useUnistyles();
    const { runningWorkout } = useRunningWorkoutStatic();
    const { elapsedFormated } = useRunningWorkoutTicker();

    if (!runningWorkout) return null;

    return (
        <Pressable
            onPress={() => router.navigate('/timer' as never)}
            accessibilityRole="button"
            accessibilityLabel={`${t('home.upNext.eyebrow.resume', { ns: 'screens' })}, ${runningWorkout.name}, ${elapsedFormated}`}
        >
            <HStack style={styles.row(compact)}>
                <Box style={styles.dot(compact)}>
                    <Icon name="dumbbell" size={compact ? 16 : 20} color={LIME} />
                </Box>
                <VStack style={styles.text}>
                    {compact ? null : (
                        <Text style={styles.eyebrow}>
                            {t('home.upNext.eyebrow.resume', { ns: 'screens' })}
                        </Text>
                    )}
                    <Text style={styles.name} numberOfLines={1}>
                        {runningWorkout.name}
                    </Text>
                </VStack>
                <Text style={styles.clock}>{elapsedFormated}</Text>
                <Icon name="chevron-right" size={14} color={theme.colors.mutedTypography} />
            </HStack>
        </Pressable>
    );
};

/** The row in a floating glass pill; `style` places it. */
export const NowPlaying: FC<{ style?: StyleProp<ViewStyle> }> = ({ style }) => {
    const { runningWorkout } = useRunningWorkoutStatic();

    if (!runningWorkout) return null;

    return (
        <FrostedGlass style={[styles.pill, style]}>
            <NowPlayingRow />
        </FrostedGlass>
    );
};
