import { FC, useCallback, useMemo } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { Play, Plus } from 'lucide-react-native';

import { Box } from '@/components/primitives/box';
import { HStack } from '@/components/primitives/hstack';
import { VStack } from '@/components/primitives/vstack';
import { Text } from '@/components/primitives/text';
import { Pressable } from '@/components/primitives/pressable';
import { useStartWorkout, type WorkoutOverviewMeta } from '@/hooks/use-workouts';
import { useEditor } from '@/hooks/use-editor';
import { useAnalytics } from '@/hooks/use-analytics';
import { reportError } from '@/services/error-reporting';

import { resolveUpNext, type UpNextState } from './resolve';

/**
 * The one thing to do next, and a button that does it.
 *
 * Before this, starting a workout meant either a `+` in the navigation bar or
 * tapping through to a workout's detail screen and finding the control there.
 * Neither reads as "begin" on a screen someone opened in order to begin.
 *
 * The three states are a priority order, not a mode: a running workout outranks
 * a planned one, and a planned one outranks the invitation to create.
 */

const styles = StyleSheet.create((theme, rt) => ({
    container: {
        paddingHorizontal: theme.space(4),
    },
    card: (isResume: boolean) => ({
        backgroundColor: isResume ? theme.colors.primary : theme.colors.foreground,
        borderRadius: theme.radius['3xl'],
        padding: theme.space(5),
        gap: theme.space(4),
    }),
    eyebrow: (isResume: boolean) => ({
        ...theme.fontSize['2xs'],
        letterSpacing: 1.2,
        textTransform: 'uppercase' as const,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: isResume ? theme.colors.primaryTypography : theme.colors.mutedTypography,
        opacity: isResume ? 0.9 : 1,
    }),
    title: (isResume: boolean) => ({
        ...theme.fontSize['2xl'],
        fontWeight: theme.fontWeight.bold.fontWeight,
        color: isResume ? theme.colors.primaryTypography : theme.colors.typography,
    }),
    meta: (isResume: boolean) => ({
        ...theme.fontSize.sm,
        color: isResume ? theme.colors.primaryTypography : theme.colors.mutedTypography,
        opacity: isResume ? 0.85 : 1,
    }),
    /**
     * A step darker than `colors.primary` on purpose.
     *
     * White on `brand[500]` is 3.41:1, and the label is 16px — too small to
     * qualify for the 3:1 large-text allowance, so it has to clear 4.5:1.
     * `brand[600]` reaches 4.48:1 and is still unmistakably the brand coral.
     * The card grounds keep `colors.primary`: their titles are `2xl` bold,
     * which the large-text bar does cover.
     */
    action: (isResume: boolean) => ({
        alignSelf: 'flex-start' as const,
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        gap: theme.space(2),
        paddingVertical: theme.space(2.5),
        paddingHorizontal: theme.space(5),
        borderRadius: theme.radius.full,
        backgroundColor: isResume ? theme.colors.primaryTypography : theme.colors.brand[600],
    }),
    // Resume inverts the pill onto white, so the coral becomes the text and has
    // to darken further still: `brand[700]` on white is 5.84:1.
    actionText: (isResume: boolean) => ({
        ...theme.fontSize.default,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: isResume ? theme.colors.brand[700] : theme.colors.primaryTypography,
    }),
    header: {
        gap: theme.space(1),
    },
    timer: {
        ...theme.fontSize.sm,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: theme.colors.primaryTypography,
        fontVariant: ['tabular-nums' as const],
    },
    row: {
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.space(3),
    },
}));

interface UpNextProps {
    state: UpNextState;
    overviewMeta?: WorkoutOverviewMeta;
    /** Live elapsed time, when the card is showing a running workout. */
    elapsedFormatted: string | null;
}

export { resolveUpNext };
export type { UpNextState };

export const UpNext: FC<UpNextProps> = ({ state, overviewMeta, elapsedFormatted }) => {
    const { t } = useTranslation(['screens', 'common']);
    const { theme } = useUnistyles();
    const { navigate } = useEditor();
    const { track } = useAnalytics();
    const { mutateAsync: startWorkout, isPending } = useStartWorkout();

    const isResume = state.kind === 'resume';

    const subtitle = useMemo(() => {
        if (state.kind === 'create') return t('home.upNext.createHint', { ns: 'screens' });

        const parts: string[] = [];

        if (overviewMeta?.exercisesCount) {
            parts.push(
                t('home.upNext.exerciseCount', {
                    ns: 'screens',
                    count: overviewMeta.exercisesCount,
                }),
            );
        }

        const muscles = (overviewMeta?.sortedPrimaryMuscleGroups ?? [])
            .slice(0, 2)
            .map((muscle) => t(`muscleGroup.${muscle}`, { ns: 'common', defaultValue: muscle }));

        if (muscles.length > 0) parts.push(muscles.join(', '));

        return parts.join(' · ');
    }, [overviewMeta, state.kind, t]);

    const handlePress = useCallback(async () => {
        if (state.kind === 'create') {
            track('workout:create_requested', { surface: 'home_up_next' });
            navigate({ type: 'workout__create' });

            return;
        }

        // Already running: nothing to start, just go back into it — on the
        // timer, which is the screen for a workout that is under way. The
        // timer's own minimize control goes to `/workout/<id>`, so the logging
        // UI stays one tap away in the other direction.
        if (state.kind === 'resume') {
            router.navigate('/timer');

            return;
        }

        try {
            // `planned` rather than a surface of its own: the event's `source`
            // records what kind of start this is, and this is still a planned
            // workout being started. Where the tap happened is a different axis.
            await startWorkout({ workoutId: state.workout.id, source: 'planned' });
            // Both start and resume land on the timer. It is the execution
            // surface for a session that is under way — one screenful of what
            // to do now and the controls for it — and the logging UI is one tap
            // away behind its minimize control.
            router.navigate('/timer');
        } catch (error) {
            reportError(error, 'Failed to start a workout from the home card');
            Alert.alert(t('home.upNext.startFailed', { ns: 'screens' }));
        }
    }, [navigate, startWorkout, state, t, track]);

    const actionLabel = t(`home.upNext.action.${state.kind}`, { ns: 'screens' });

    return (
        <Box style={styles.container}>
            <Pressable
                style={styles.card(isResume)}
                onPress={handlePress}
                disabled={isPending}
                accessibilityRole="button"
                accessibilityLabel={actionLabel}
            >
                <HStack style={styles.row}>
                    <VStack style={styles.header}>
                        <Text style={styles.eyebrow(isResume)}>
                            {t(`home.upNext.eyebrow.${state.kind}`, { ns: 'screens' })}
                        </Text>
                        <Text style={styles.title(isResume)} numberOfLines={2}>
                            {state.kind === 'create'
                                ? t('home.upNext.createTitle', { ns: 'screens' })
                                : state.workout.name}
                        </Text>
                    </VStack>

                    {isResume && elapsedFormatted ? (
                        <Text style={styles.timer}>{elapsedFormatted}</Text>
                    ) : null}
                </HStack>

                {subtitle ? (
                    <Text style={styles.meta(isResume)} numberOfLines={1}>
                        {subtitle}
                    </Text>
                ) : null}

                <Box style={styles.action(isResume)}>
                    {state.kind === 'create' ? (
                        <Plus
                            size={theme.space(4.5)}
                            strokeWidth={2.25}
                            color={
                                isResume ? theme.colors.brand[700] : theme.colors.primaryTypography
                            }
                        />
                    ) : (
                        <Play
                            size={theme.space(4.5)}
                            strokeWidth={2.25}
                            fill={
                                isResume ? theme.colors.brand[700] : theme.colors.primaryTypography
                            }
                            color={
                                isResume ? theme.colors.brand[700] : theme.colors.primaryTypography
                            }
                        />
                    )}
                    <Text style={styles.actionText(isResume)}>{actionLabel}</Text>
                </Box>
            </Pressable>
        </Box>
    );
};
