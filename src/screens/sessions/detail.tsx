import { FC, useMemo, useRef } from 'react';
import type { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';

import { ScrollView } from '@/components/primitives/scrollview';
import { Box } from '@/components/primitives/box';
import { HStack } from '@/components/primitives/hstack';
import { VStack } from '@/components/primitives/vstack';
import { Text } from '@/components/primitives/text';
import { Icon } from '@/components/primitives/icon';
import { Pressable } from '@/components/primitives/pressable';
import { HeaderButton } from '@/components/buttons/header';
import { ShareCard } from '@/components/brand/share-card';
import { JOIN_URL } from '@/constants/contact';
import { ModalHeader, modalStyles } from '@/components/layout/modal-header';
import { useWorkouts, useWorkoutWithDetails } from '@/hooks/use-workouts';
import { formatSet } from '@/helpers/workouts';
import { useWorkoutHealthStats } from '@/hooks/use-workout-health-stats';
import { runInBackground } from '@/services/error-reporting';
import { shareCard } from '@/services/share';
import { Metric } from '@/screens/home/components/charts';

import { SESSION_COLORS } from './components/list/types';
import { clock, sessionMs } from './data';

/**
 * One session, after Apple Fitness's workout summary: when it ran; its time,
 * sets, volume, heart rate and calories; and every exercise with the sets
 * actually logged. Show More opens the workout itself.
 */

const styles = StyleSheet.create((theme) => ({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    hero: {
        alignItems: 'center',
        gap: theme.space(3),
    },
    icon: {
        height: 64,
        width: 64,
        borderRadius: theme.radius['2xl'],
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: `${SESSION_COLORS.duration}26`,
    },
    name: {
        ...theme.fontSize.xl,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: theme.colors.typography,
    },
    range: {
        ...theme.fontSize.default,
        color: theme.colors.mutedTypography,
    },
    sectionRow: {
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: theme.space(4),
    },
    sectionTitle: {
        ...theme.fontSize['2xl'],
        fontWeight: theme.fontWeight.bold.fontWeight,
        color: theme.colors.typography,
    },
    link: {
        ...theme.fontSize.default,
        color: SESSION_COLORS.duration,
    },
    card: {
        padding: theme.space(4),
        gap: theme.space(3),
        borderRadius: theme.radius.xl,
        backgroundColor: theme.colors.foreground,
    },
    cell: {
        flex: 1,
    },
    label: {
        ...theme.fontSize.default,
        color: theme.colors.typography,
    },
    pairBlock: {
        gap: theme.space(3),
    },
    spaced: {
        marginTop: theme.space(4),
    },
    exerciseHead: {
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.space(3),
    },
    exerciseName: {
        ...theme.fontSize.default,
        flex: 1,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: theme.colors.typography,
    },
    sets: {
        ...theme.fontSize.sm,
        color: theme.colors.mutedTypography,
        marginTop: -theme.space(2),
    },
    divider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: theme.colors.border,
    },
    shareArt: {
        height: 200,
        width: 200,
        borderRadius: theme.radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 3,
        borderColor: SESSION_COLORS.duration,
        backgroundColor: `${SESSION_COLORS.duration}1f`,
    },
}));

const SessionDetailScreen: FC = () => {
    const { t, i18n } = useTranslation(['screens']);
    const { workoutId } = useLocalSearchParams<{ workoutId: string }>();
    const card = useRef<View>(null);
    const { data: workouts } = useWorkouts();
    const workout = workouts?.find((w) => w.id === workoutId);
    const { stats } = useWorkoutHealthStats(workout);
    const { data: details } = useWorkoutWithDetails(workoutId);

    // What was actually done: each exercise in order, its finished sets, and the volume moved.
    const { exercises, totals } = useMemo(() => {
        // In the workout's order; typed from the flat list, which the groups regroup.
        type Item = NonNullable<typeof details>['exercises'][number];
        const items = (details?.groups ?? []).flatMap((group) => group.exercises as Item[]);
        const finishedSets = items.flatMap((item) => item.sets.filter((set) => set.completedAt));

        const rows = items.map((item) => {
            const finished = item.sets.filter((set) => set.completedAt);

            return {
                id: item.workoutExercise.id,
                name: item.exercise.name,
                done: finished.length,
                total: item.sets.length,
                lines: finished.map((set) => formatSet(item.exercise, set)).filter(Boolean),
            };
        });

        return {
            exercises: rows,
            totals: {
                done: finishedSets.length,
                total: items.reduce((sum, item) => sum + item.sets.length, 0),
                volume: finishedSets.reduce(
                    (sum, set) => sum + (set.weight ?? 0) * (set.reps ?? 0),
                    0,
                ),
                unit: finishedSets.find((set) => set.weightUnits)?.weightUnits ?? 'kg',
            },
        };
    }, [details]);

    if (!workout) return null;

    const ended = dayjs(workout.completedAt).locale(i18n.language);
    const range = workout.startedAt
        ? `${dayjs(workout.startedAt).format('h:mm A')}–${ended.format('h:mm A')}`
        : ended.format('h:mm A');
    const time = clock(sessionMs(workout), true);
    const kcal = (value: number | null | undefined) =>
        value == null ? '–' : String(Math.round(value));

    const figures: { key: string; label: string; value: string; unit?: string; color: string }[] = [
        {
            key: 'time',
            label: t('sessions.workoutTime', { ns: 'screens' }),
            value: time,
            color: SESSION_COLORS.time,
        },
        {
            key: 'sets',
            label: t('sessions.sets', { ns: 'screens' }),
            value: `${totals.done}/${totals.total}`,
            color: SESSION_COLORS.duration,
        },
        {
            key: 'volume',
            label: t('sessions.volume', { ns: 'screens' }),
            value: totals.volume ? Math.round(totals.volume).toLocaleString() : '–',
            unit: totals.volume ? totals.unit : undefined,
            color: SESSION_COLORS.duration,
        },
        {
            key: 'heart',
            label: t('sessions.avgHeartRate', { ns: 'screens' }),
            value: stats?.avgHeartRate ? String(Math.round(stats.avgHeartRate)) : '–',
            unit: stats?.avgHeartRate ? 'bpm' : undefined,
            color: SESSION_COLORS.kcal,
        },
        {
            key: 'active',
            label: t('sessions.activeKcal', { ns: 'screens' }),
            value: kcal(stats?.activeCalories),
            unit: 'kcal',
            color: SESSION_COLORS.kcal,
        },
        {
            key: 'total',
            label: t('sessions.totalKcal', { ns: 'screens' }),
            value: kcal(stats?.totalCalories),
            unit: 'kcal',
            color: SESSION_COLORS.kcal,
        },
    ];
    const pairs = [figures.slice(0, 2), figures.slice(2, 4), figures.slice(4, 6)];

    const date = ended.format('ddd, D MMM');
    const share = () =>
        runInBackground(
            () =>
                shareCard(
                    card,
                    t('share.session.message', {
                        ns: 'screens',
                        name: workout.name,
                        time,
                        date,
                        url: JOIN_URL,
                    }),
                ),
            'Failed to share a session:',
        );

    return (
        <ScrollView style={styles.container} contentContainerStyle={modalStyles.content}>
            <ModalHeader
                title={ended.format('ddd, MMM D')}
                done={false}
                right={
                    <HeaderButton
                        icon="share"
                        onPress={share}
                        accessibilityLabel={t('sessions.share', { ns: 'screens' })}
                    />
                }
            />

            <HStack style={styles.hero}>
                <Box style={styles.icon}>
                    <Icon name="dumbbell" size={30} color={SESSION_COLORS.duration} />
                </Box>
                <VStack>
                    <Text style={styles.name}>{workout.name}</Text>
                    <Text style={styles.range}>{range}</Text>
                </VStack>
            </HStack>

            <HStack style={styles.sectionRow}>
                <Text style={styles.sectionTitle} accessibilityRole="header">
                    {t('sessions.details', { ns: 'screens' })}
                </Text>
                <Pressable
                    onPress={() => router.navigate(`/workout/${workout.id}`)}
                    accessibilityRole="button"
                >
                    <Text style={styles.link}>{t('sessions.showMore', { ns: 'screens' })}</Text>
                </Pressable>
            </HStack>

            <VStack style={styles.card}>
                {pairs.map((pair, row) => (
                    <VStack key={row} style={styles.pairBlock}>
                        {row > 0 ? <Box style={styles.divider} /> : null}
                        <HStack>
                            {pair.map((figure) => (
                                <VStack key={figure.key} style={styles.cell}>
                                    <Text style={styles.label}>{figure.label}</Text>
                                    <Metric
                                        value={figure.value}
                                        unit={figure.unit}
                                        color={figure.color}
                                        size={28}
                                    />
                                </VStack>
                            ))}
                        </HStack>
                    </VStack>
                ))}
            </VStack>

            {exercises.length ? (
                <>
                    <Text style={[styles.sectionTitle, styles.spaced]} accessibilityRole="header">
                        {t('sessions.exercises', { ns: 'screens' })}
                    </Text>
                    <VStack style={styles.card}>
                        {exercises.map((item, index) => (
                            <VStack key={item.id} style={styles.pairBlock}>
                                {index > 0 ? <Box style={styles.divider} /> : null}
                                <HStack style={styles.exerciseHead}>
                                    <Text style={styles.exerciseName} numberOfLines={1}>
                                        {item.name}
                                    </Text>
                                    <Text style={styles.range}>
                                        {t('sessions.setsDone', {
                                            ns: 'screens',
                                            done: item.done,
                                            count: item.total,
                                        })}
                                    </Text>
                                </HStack>
                                {item.lines.length ? (
                                    <Text style={styles.sets}>{item.lines.join('  ·  ')}</Text>
                                ) : null}
                            </VStack>
                        ))}
                    </VStack>
                </>
            ) : null}
            <ShareCard
                ref={card}
                accent={SESSION_COLORS.duration}
                eyebrow={t('share.session.eyebrow', { ns: 'screens' })}
                title={workout.name}
                subtitle={t('share.session.subtitle', {
                    ns: 'screens',
                    time,
                    count: totals.done,
                    date,
                })}
                art={
                    <Box style={styles.shareArt}>
                        <Icon name="dumbbell" size={88} color={SESSION_COLORS.duration} />
                    </Box>
                }
            />
        </ScrollView>
    );
};

export default SessionDetailScreen;
