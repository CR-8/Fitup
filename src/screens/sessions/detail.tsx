import { FC } from 'react';
import { Share } from 'react-native';
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
import { ModalHeader, modalStyles } from '@/components/layout/modal-header';
import { useWorkouts } from '@/hooks/use-workouts';
import { useWorkoutHealthStats } from '@/hooks/use-workout-health-stats';
import { runInBackground } from '@/services/error-reporting';
import { Metric } from '@/screens/home/components/charts';

import { SESSION_COLORS } from './components/list/types';
import { clock, sessionMs } from './data';

/**
 * One session, after Apple Fitness's workout summary: when it ran, and its
 * time and calories (from Health). Show More opens the full workout, sets and all.
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
        backgroundColor: theme.colors.elevated,
    },
    cell: {
        flex: 1,
    },
    label: {
        ...theme.fontSize.default,
        color: theme.colors.typography,
    },
    divider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: theme.colors.border,
    },
}));

const SessionDetailScreen: FC = () => {
    const { t, i18n } = useTranslation(['screens']);
    const { workoutId } = useLocalSearchParams<{ workoutId: string }>();
    const { data: workouts } = useWorkouts();
    const workout = workouts?.find((w) => w.id === workoutId);
    const { stats } = useWorkoutHealthStats(workout);

    if (!workout) return null;

    const ended = dayjs(workout.completedAt).locale(i18n.language);
    const range = workout.startedAt
        ? `${dayjs(workout.startedAt).format('h:mm A')}–${ended.format('h:mm A')}`
        : ended.format('h:mm A');
    const time = clock(sessionMs(workout), true);
    const kcal = (value: number | null | undefined) =>
        value == null ? '–' : String(Math.round(value));

    const share = () =>
        runInBackground(
            () =>
                Share.share({
                    message: t('sessions.shareMessage', {
                        ns: 'screens',
                        name: workout.name,
                        time,
                        date: ended.format('ddd, MMM D'),
                    }),
                }),
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
                <HStack>
                    <VStack style={styles.cell}>
                        <Text style={styles.label}>
                            {t('sessions.workoutTime', { ns: 'screens' })}
                        </Text>
                        <Metric value={time} color={SESSION_COLORS.time} size={28} />
                    </VStack>
                    <VStack style={styles.cell}>
                        <Text style={styles.label}>
                            {t('sessions.activeKcal', { ns: 'screens' })}
                        </Text>
                        <Metric
                            value={kcal(stats?.activeCalories)}
                            unit="kcal"
                            color={SESSION_COLORS.kcal}
                            size={28}
                        />
                    </VStack>
                </HStack>
                <Box style={styles.divider} />
                <VStack style={styles.cell}>
                    <Text style={styles.label}>{t('sessions.totalKcal', { ns: 'screens' })}</Text>
                    <Metric
                        value={kcal(stats?.totalCalories)}
                        unit="kcal"
                        color={SESSION_COLORS.kcal}
                        size={28}
                    />
                </VStack>
            </VStack>
        </ScrollView>
    );
};

export default SessionDetailScreen;
