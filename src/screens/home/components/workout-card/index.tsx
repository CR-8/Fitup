import { FC, memo, useCallback, useMemo } from 'react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Reanimated, { SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { Trash2, Play } from 'lucide-react-native';
import dayjs from 'dayjs';
import localizedFormat from 'dayjs/plugin/localizedFormat';
import { isNumber } from 'lodash';

import { Pressable } from '@/components/primitives/pressable';
import { Box } from '@/components/primitives/box';
import { Text } from '@/components/primitives/text';
import { WorkoutSelect } from '@/db/schema';
import { VStack } from '@/components/primitives/vstack';
import { HStack } from '@/components/primitives/hstack';
import { useDeleteWorkout, type WorkoutOverviewMeta } from '@/hooks/use-workouts';
import { formatWorkoutDuration } from '@/helpers/times';

dayjs.extend(localizedFormat);

/**
 * A workout, in a list of them.
 *
 * The muscle groups used to be a comma-joined sentence sharing a line with the
 * duration, which made the two read as one run-on string. They are chips now:
 * the same information, but scannable at the speed someone actually reads a
 * list.
 *
 * Two things here are load-bearing and easy to lose in a restyle. The
 * `Swipeable` wrapper is the only way to delete a workout from this screen — its
 * radius lives on the container so the red action is revealed with the same
 * corners. And `in_progress` inverts the whole card onto the accent colour,
 * which is what makes a running workout findable at a glance.
 */

const styles = StyleSheet.create((theme) => ({
    container: (status: WorkoutSelect['status']) => ({
        backgroundColor: status === 'in_progress' ? theme.colors.primary : theme.colors.foreground,
    }),
    card: {
        paddingVertical: theme.space(4),
        paddingHorizontal: theme.space(5),
        gap: theme.space(2),
    },
    topRow: {
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.space(2),
    },
    eyebrow: (status: WorkoutSelect['status']) => ({
        ...theme.fontSize['2xs'],
        letterSpacing: 1.1,
        textTransform: 'uppercase' as const,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color:
            status === 'in_progress'
                ? theme.colors.primaryTypography
                : theme.colors.mutedTypography,
        opacity: status === 'in_progress' ? 0.9 : 1,
        flexShrink: 1,
    }),
    title: (status: WorkoutSelect['status']) => ({
        ...theme.fontSize.lg,
        fontWeight: theme.fontWeight.bold.fontWeight,
        color: status === 'in_progress' ? theme.colors.primaryTypography : theme.colors.typography,
    }),
    trailing: (status: WorkoutSelect['status']) => ({
        ...theme.fontSize.sm,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color:
            status === 'in_progress'
                ? theme.colors.primaryTypography
                : theme.colors.mutedTypography,
        fontVariant: ['tabular-nums' as const],
    }),
    chipRow: {
        flexWrap: 'wrap',
        gap: theme.space(1.5),
        alignItems: 'center',
    },
    chip: (status: WorkoutSelect['status']) => ({
        paddingHorizontal: theme.space(2.5),
        paddingVertical: theme.space(1),
        borderRadius: theme.radius.full,
        backgroundColor:
            status === 'in_progress' ? 'rgba(255,255,255,0.18)' : theme.colors.background,
    }),
    chipText: (status: WorkoutSelect['status']) => ({
        ...theme.fontSize.xs,
        fontWeight: theme.fontWeight.medium.fontWeight,
        color: status === 'in_progress' ? theme.colors.primaryTypography : theme.colors.typography,
    }),
    // The affordance the plan called for: a planned workout should look startable.
    startHint: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space(1),
        marginLeft: 'auto',
    },
    startHintText: {
        ...theme.fontSize.xs,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: theme.colors.primary,
    },
    swipeable: {
        backgroundColor: theme.colors.red[500],
        borderRadius: theme.radius['4xl'],
    },
    swipeableContainer: {
        backgroundColor: theme.colors.background,
        width: '100%',
    },
    rightAction: {
        width: 75,
        height: '100%',
        backgroundColor: theme.colors.red[500],
        justifyContent: 'center',
        alignItems: 'center',
    },
}));

interface WorkoutCardProps {
    workout: WorkoutSelect;
    onPress: (workoutId: string) => void;
    activeElapsedFormatted: string | null;
    overviewMeta?: WorkoutOverviewMeta;
}

interface RightActionProps {
    prog: SharedValue<number>;
    drag: SharedValue<number>;
    handleDelete: () => void;
}

const RightAction: FC<RightActionProps> = ({ drag, handleDelete }) => {
    const { theme } = useUnistyles();

    const styleAnimation = useAnimatedStyle(() => {
        return {
            transform: [{ translateX: drag.value + 75 }],
        };
    });

    return (
        <Reanimated.View style={[styles.rightAction, styleAnimation]}>
            <Pressable onPress={handleDelete}>
                <Trash2 color={theme.colors.neutral[50]} size={theme.space(6)} strokeWidth={1.75} />
            </Pressable>
        </Reanimated.View>
    );
};

const WorkoutCardComponent: FC<WorkoutCardProps> = ({
    workout,
    onPress,
    activeElapsedFormatted,
    overviewMeta,
}) => {
    const { t, i18n } = useTranslation(['common', 'screens']);
    const { theme } = useUnistyles();

    const deleteWorkout = useDeleteWorkout();

    // Capped: past three, chips wrap to a second line and the card stops being
    // a glance.
    const muscleGroups = useMemo(
        () => (overviewMeta?.sortedPrimaryMuscleGroups ?? []).slice(0, 3),
        [overviewMeta],
    );

    const handlePress = useCallback(() => {
        onPress(workout.id);
    }, [onPress, workout.id]);

    const formattedDate = useMemo(() => {
        if (workout.status === 'planned' && workout.startAt) {
            return dayjs(workout.startAt).locale(i18n.language).format('lll');
        }

        if (workout.status === 'completed' && workout.completedAt) {
            const dayName = dayjs(workout.completedAt).locale(i18n.language).format('dddd');
            return dayName.charAt(0).toUpperCase() + dayName.slice(1);
        }

        return null;
    }, [workout.status, workout.startAt, workout.completedAt, i18n.language]);

    const formattedDuration =
        workout.status === 'completed' && isNumber(workout.duration)
            ? formatWorkoutDuration(workout.duration)
            : null;

    /** The status line: when it happened, and what kind of session it was. */
    const eyebrow = useMemo(() => {
        const when =
            workout.status === 'in_progress'
                ? t('now', { ns: 'common' })
                : workout.status === 'planned'
                  ? (formattedDate ?? t('workoutStatus.planned', { ns: 'common' }))
                  : formattedDate;

        const kinds = (overviewMeta?.sortedWorkoutTypes ?? []).map((type) =>
            t(`exerciseCategory.${type}`, { ns: 'common' }),
        );

        return [when, ...kinds].filter(Boolean).join(' · ');
    }, [formattedDate, overviewMeta, t, workout.status]);

    const trailing = workout.status === 'in_progress' ? activeElapsedFormatted : formattedDuration;

    const handleDelete = useCallback(() => {
        deleteWorkout.mutate(workout.id);
    }, [workout, deleteWorkout]);

    return (
        <Swipeable
            containerStyle={styles.swipeable}
            childrenContainerStyle={styles.swipeableContainer}
            friction={2}
            enableTrackpadTwoFingerGesture
            rightThreshold={40}
            renderRightActions={(prog, drag) => (
                <RightAction prog={prog} drag={drag} handleDelete={handleDelete} />
            )}
        >
            <Box style={styles.container(workout.status)}>
                <Pressable onPress={handlePress}>
                    <VStack style={styles.card}>
                        <HStack style={styles.topRow}>
                            <Text style={styles.eyebrow(workout.status)} numberOfLines={1}>
                                {eyebrow}
                            </Text>
                            {trailing ? (
                                <Text style={styles.trailing(workout.status)}>{trailing}</Text>
                            ) : null}
                        </HStack>

                        <Text style={styles.title(workout.status)} numberOfLines={2}>
                            {workout.name}
                        </Text>

                        {muscleGroups.length > 0 || workout.status === 'planned' ? (
                            <HStack style={styles.chipRow}>
                                {muscleGroups.map((muscle) => (
                                    <Box key={muscle} style={styles.chip(workout.status)}>
                                        <Text style={styles.chipText(workout.status)}>
                                            {t(`muscleGroup.${muscle}`, {
                                                ns: 'common',
                                                defaultValue: muscle,
                                            })}
                                        </Text>
                                    </Box>
                                ))}

                                {workout.status === 'planned' ? (
                                    <Box style={styles.startHint}>
                                        <Play
                                            size={theme.space(3.5)}
                                            strokeWidth={2.5}
                                            fill={theme.colors.primary}
                                            color={theme.colors.primary}
                                        />
                                        <Text style={styles.startHintText}>
                                            {t('home.upNext.action.start', { ns: 'screens' })}
                                        </Text>
                                    </Box>
                                ) : null}
                            </HStack>
                        ) : null}
                    </VStack>
                </Pressable>
            </Box>
        </Swipeable>
    );
};

export const WorkoutCard = memo(WorkoutCardComponent, (prev, next) => {
    return (
        prev.workout === next.workout &&
        prev.onPress === next.onPress &&
        prev.activeElapsedFormatted === next.activeElapsedFormatted &&
        prev.overviewMeta === next.overviewMeta
    );
});
