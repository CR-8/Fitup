import { FC, useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native-unistyles';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Box } from '@/components/primitives/box';
import { useExercise } from '@/hooks/use-exercises';
import { Guide } from '@/screens/exercises/exercise/components/guide';

import { Stack } from '@/navigators/stack';
import { ScrollView } from '@/components/primitives/scrollview';
import { HeaderTextButton } from '@/components/buttons/header';
import { useAnalytics } from '@/hooks/use-analytics';
import { isFitupExerciseUserId } from '@/constants/fitup';

const styles = StyleSheet.create((theme) => ({
    container: {
        flex: 1,
    },
    content: {
        flex: 1,
    },
    scroll: {
        ...theme.screenContentPadding('child'),
    },
}));

const GuideScreen: FC = () => {
    const { exerciseId } = useLocalSearchParams<{ exerciseId: string }>();
    const { data: exercise } = useExercise(exerciseId ?? '');
    const { track } = useAnalytics();
    const { t } = useTranslation(['common', 'screens']);
    const trackedRef = useRef(false);

    useEffect(() => {
        if (!exercise || trackedRef.current) return;
        trackedRef.current = true;
        track('exercise:guide_viewed', {
            surface: 'active_workout',
            ownership: isFitupExerciseUserId(exercise.userId) ? 'system' : 'custom',
            category: exercise.category,
        });
    }, [exercise, track]);

    const handleClose = () => {
        router.back();
    };

    return (
        <Box style={styles.container}>
            <Stack.Screen
                options={{
                    title: t('exercise.tabs.guide', { ns: 'screens' }),
                    headerRight: () => (
                        <HeaderTextButton
                            title={t('done', { ns: 'common' })}
                            onPress={handleClose}
                            prominent
                        />
                    ),
                }}
            />
            <Box style={styles.content}>
                {exercise && (
                    <ScrollView contentContainerStyle={styles.scroll}>
                        <Guide exercise={exercise} />
                    </ScrollView>
                )}
            </Box>
        </Box>
    );
};

export default GuideScreen;
