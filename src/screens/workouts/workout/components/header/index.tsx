import { FC, useMemo } from 'react';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';

import { Title } from '@/components/typography/title';
import { Box } from '@/components/primitives/box';
import { useLocalSearchParams } from 'expo-router';
import { useWorkout } from '@/hooks/use-workouts';
import { useRunningWorkoutTicker } from '@/hooks/use-running-workout';
import { useSupersetEditStore } from '@/stores/superset-edit';
import { useAiProfile } from '@/hooks/use-ai';
import { SegmentedControl } from '@expo/ui/community/segmented-control';

import { Stack } from '@/navigators/stack';

const styles = StyleSheet.create((theme) => ({
    container: {
        paddingHorizontal: theme.space(4),
        paddingTop: theme.space(2),
        paddingBottom: theme.space(5),
        gap: theme.space(3),
    },
    environmentToggle: {
        alignSelf: 'flex-start',
        minWidth: theme.space(40),
    },
}));

export const Header: FC = () => {
    const { workoutId } = useLocalSearchParams<{ workoutId: string }>();
    const { t } = useTranslation(['common', 'screens']);

    const { data: workout } = useWorkout(workoutId);

    const { elapsedSeconds, elapsedFormated } = useRunningWorkoutTicker();

    const isEditMode = useSupersetEditStore((state) => state.workoutId === workoutId);

    // Doesn't regenerate the plan already on this workout — it filters which
    // of its exercises get the "needs equipment" badge (see the Exercise
    // component) and sets what the next AI plan assumes by default.
    const { profile, save: saveProfile } = useAiProfile();
    const environmentChoices = useMemo(
        () => [
            { value: 'home', title: t('onboarding.trainingEnvironment.home', { ns: 'screens' }) },
            { value: 'gym', title: t('onboarding.trainingEnvironment.gym', { ns: 'screens' }) },
        ],
        [t],
    );

    const title = useMemo(() => {
        if (isEditMode) {
            return t('workout.supersets.edit', { ns: 'screens' });
        }
        if (workout?.status === 'in_progress' && elapsedSeconds > 0) {
            return elapsedFormated;
        }
        if (workout?.status) {
            return t(`workoutStatus.${workout?.status}`, { ns: 'common' });
        }
        return null;
    }, [isEditMode, workout?.status, elapsedSeconds, elapsedFormated, t]);

    return (
        <Box style={styles.container}>
            {/* The session's state — its running clock, or planned / done — is
                the navigation title; the workout's name leads the page. */}
            <Stack.Screen options={{ title: title ?? '' }} />
            <Title type="h2">{workout?.name}</Title>
            <SegmentedControl
                style={styles.environmentToggle}
                values={environmentChoices.map((choice) => choice.title)}
                selectedIndex={environmentChoices.findIndex(
                    (choice) => choice.value === (profile?.trainingEnvironment ?? 'gym'),
                )}
                onChange={({ nativeEvent }) =>
                    saveProfile({
                        trainingEnvironment: environmentChoices[nativeEvent.selectedSegmentIndex]
                            .value as 'home' | 'gym',
                    })
                }
            />
        </Box>
    );
};
