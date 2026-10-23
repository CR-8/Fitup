import { FC, memo, useCallback, useMemo } from 'react';
import { Platform, type ColorValue } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Reanimated, { SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import dayjs from 'dayjs';
import localizedFormat from 'dayjs/plugin/localizedFormat';
import { isNumber } from 'lodash';

import { Pressable } from '@/components/primitives/pressable';
import { Box } from '@/components/primitives/box';
import { Text } from '@/components/primitives/text';
import { WorkoutSelect } from '@/db/schema';
import { VStack } from '@/components/primitives/vstack';
import { useDeleteWorkout, type WorkoutOverviewMeta } from '@/hooks/use-workouts';
import { formatWorkoutDuration } from '@/helpers/times';
import { Icon } from '@/components/primitives/icon';
import { getTrainingType } from '@/helpers/training-type';

dayjs.extend(localizedFormat);

/**
 * A workout, in a list of them, drawn as the reference's session row: a
 * tinted glyph for the kind of training, the name, then the figure that
 * matters in the training colour (the time it took, the time it is planned
 * for, or the clock of a running one), with the day on the trailing edge.
 *
 * Two things here are load-bearing and easy to lose in a restyle. The
 * `Swipeable` wrapper is the only way to delete a workout from this screen — its
 * radius lives on the container so the red action is revealed with the same
 * corners. And `in_progress` outlines the card in the accent, which is what
 * makes a running workout findable at a glance.
 */

const styles = StyleSheet.create((theme) => ({
    container: (status: WorkoutSelect['status']) => ({
        backgroundColor: theme.colors.foreground,
        borderRadius: theme.radius['4xl'],
        borderCurve: 'continuous' as const,
        borderWidth: 1,
        borderColor: status === 'in_progress' ? theme.colors.brand[500] : theme.colors.border,
        overflow: 'hidden' as const,
    }),
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: theme.space(3.5),
        paddingHorizontal: theme.space(4),
        gap: theme.space(3),
    },
    glyph: (color: string) => ({
        height: theme.space(11),
        width: theme.space(11),
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: theme.radius.xl,
        borderCurve: 'continuous' as const,
        // The training colour at a low alpha, so the glyph reads as a tint.
        backgroundColor: `${color}2e`,
    }),
    body: {
        flex: 1,
        gap: theme.space(0.5),
    },
    title: {
        ...theme.fontSize.default,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: theme.colors.typography,
    },
    value: (color: ColorValue) => ({
        fontSize: 28,
        lineHeight: 32,
        color,
        ...theme.typography.metric,
    }),
    detail: {
        ...theme.fontSize.sm,
        color: theme.colors.mutedTypography,
    },
    trailing: {
        alignSelf: 'flex-end',
        alignItems: 'flex-end',
        gap: theme.space(0.5),
    },
    when: {
        ...theme.fontSize.xs,
        color: theme.colors.mutedTypography,
    },
    syn: {
        ...theme.typography.eyebrow,
        color: theme.colors.primary,
    },
    swipeable: {
        backgroundColor: Platform.select({
            ios: theme.colors.destructive,
            default: theme.colors.red[500],
        }),
        borderRadius: theme.radius['2xl'],
        borderCurve: 'continuous',
    },
    swipeableContainer: {
        backgroundColor: theme.colors.background,
        width: '100%',
    },
    rightAction: {
        width: 75,
        height: '100%',
        backgroundColor: Platform.select({
            ios: theme.colors.destructive,
            default: theme.colors.red[500],
        }),
        justifyContent: 'center',
        alignItems: 'center',
    },
}));

interface WorkoutCardProps {
    workout: WorkoutSelect;
    onPress: (workoutId: string) => void;
    activeElapsedFormatted: string | null;
    overviewMeta?: WorkoutOverviewMeta;
    /** "Push A · Week 2", when the screen knows the week; otherwise the stored name. */
    displayName?: string;
    /** The session came from a Syn plan. */
    bySyn?: boolean;
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
                <Icon name="trash" color={theme.colors.neutral[50]} size={theme.space(6)} />
            </Pressable>
        </Reanimated.View>
    );
};

const WorkoutCardComponent: FC<WorkoutCardProps> = ({
    workout,
    onPress,
    activeElapsedFormatted,
    overviewMeta,
    displayName,
    bySyn,
}) => {
    const { t, i18n } = useTranslation(['common', 'screens']);
    const { theme } = useUnistyles();
    const typeColor =
        theme.colors.training[getTrainingType(overviewMeta?.sortedPrimaryMuscleGroups)];

    const deleteWorkout = useDeleteWorkout();

    const muscles = useMemo(
        () =>
            (overviewMeta?.sortedPrimaryMuscleGroups ?? [])
                .slice(0, 3)
                .map((muscle) => t(`muscleGroup.${muscle}`, { ns: 'common', defaultValue: muscle }))
                .join(' · '),
        [overviewMeta, t],
    );

    const handlePress = useCallback(() => {
        onPress(workout.id);
    }, [onPress, workout.id]);

    // The trailing edge: the weekday for a finished session, the day for a
    // planned one, "Now" for one under way.
    const when = useMemo(() => {
        if (workout.status === 'in_progress') return t('now', { ns: 'common' });

        const at = workout.status === 'completed' ? workout.completedAt : (workout.startAt ?? null);
        if (!at) return t('workoutStatus.planned', { ns: 'common' });

        const day = dayjs(at).locale(i18n.language);
        const label = day.isSame(dayjs(), 'week') ? day.format('dddd') : day.format('D MMM');

        return label.charAt(0).toUpperCase() + label.slice(1);
    }, [i18n.language, t, workout.completedAt, workout.startAt, workout.status]);

    // The big figure: how long it took, how long it has run, or when it starts.
    const value =
        workout.status === 'in_progress'
            ? activeElapsedFormatted
            : workout.status === 'completed' && isNumber(workout.duration)
              ? formatWorkoutDuration(workout.duration)
              : workout.status === 'planned' && workout.startAt
                ? dayjs(workout.startAt).locale(i18n.language).format('LT')
                : null;
    const valueColor =
        workout.status === 'in_progress'
            ? theme.colors.brand[500]
            : workout.status === 'completed'
              ? typeColor
              : theme.colors.mutedTypography;

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
                <Pressable onPress={handlePress} accessibilityRole="button">
                    <Box style={styles.card}>
                        <Box style={styles.glyph(typeColor)}>
                            <Icon name="dumbbell" size={20} color={typeColor} />
                        </Box>

                        <VStack style={styles.body}>
                            <Text style={styles.title} numberOfLines={1}>
                                {displayName ?? workout.name}
                            </Text>
                            {value ? <Text style={styles.value(valueColor)}>{value}</Text> : null}
                            {muscles ? (
                                <Text style={styles.detail} numberOfLines={1}>
                                    {muscles}
                                </Text>
                            ) : null}
                        </VStack>

                        <VStack style={styles.trailing}>
                            {bySyn ? (
                                <Text style={styles.syn}>
                                    {t('plan.updatedBySyn', { ns: 'screens' })}
                                </Text>
                            ) : null}
                            <Text style={styles.when}>{when}</Text>
                        </VStack>
                    </Box>
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
        prev.overviewMeta === next.overviewMeta &&
        prev.displayName === next.displayName &&
        prev.bySyn === next.bySyn
    );
});
