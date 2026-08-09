import { FC, useMemo, useState } from 'react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Image as ExpoImage } from 'expo-image';

import { ScrollView } from '@/components/primitives/scrollview';
import { VStack } from '@/components/primitives/vstack';
import { HStack } from '@/components/primitives/hstack';
import { Text } from '@/components/primitives/text';
import { Title } from '@/components/typography/title';
import { Button } from '@/components/buttons/base';
import { Guide } from '@/screens/exercises/exercise/components/guide';
import { useExercise } from '@/hooks/use-exercises';
import { useRestTicker } from '@/hooks/use-rest-ticker';
import {
    buildExerciseGifUrl,
    EXERCISE_GIF_PREVIEW_RESOLUTION,
    EXERCISE_MEDIA_ATTRIBUTION,
} from '@/constants/fitup';

const styles = StyleSheet.create((theme, rt) => ({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    content: {
        paddingTop: theme.screenHeaderHeight(),
        paddingBottom: rt.insets.bottom + theme.space(6),
        gap: theme.space(5),
    },
    header: {
        paddingHorizontal: theme.space(4),
        gap: theme.space(1),
    },
    muted: {
        color: theme.colors.neutral[400],
    },
    mediaPanel: {
        marginHorizontal: theme.space(4),
        backgroundColor: theme.colors.foreground,
        borderRadius: theme.radius['4xl'],
        padding: theme.space(4),
        gap: theme.space(2),
        alignItems: 'center',
    },
    media: {
        width: '100%',
        aspectRatio: 1,
        borderRadius: theme.radius['2xl'],
    },
    attribution: {
        color: theme.colors.neutral[500],
    },
    // The clock is the focal point while a set is running, so it gets the
    // largest type on the screen.
    timerPanel: {
        marginHorizontal: theme.space(4),
        backgroundColor: theme.colors.foreground,
        borderRadius: theme.radius['4xl'],
        paddingVertical: theme.space(6),
        alignItems: 'center',
        gap: theme.space(1),
    },
    timerValue: {
        fontVariant: ['tabular-nums'],
    },
    actions: {
        paddingHorizontal: theme.space(4),
    },
}));

const formatDuration = (totalSeconds: number): string => {
    const safe = Math.max(0, Math.floor(totalSeconds));
    const minutes = Math.floor(safe / 60);
    const seconds = safe % 60;

    return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

const normalizeParam = (value: string | string[] | undefined): string =>
    Array.isArray(value) ? (value[0] ?? '') : (value ?? '');

/**
 * Shown while a set is in progress: the movement, how to perform it, and the
 * elapsed time in one place.
 *
 * The instructions come from the bundled catalogue, so this works with no
 * network. The animation only appears when a media host is configured.
 */
const TimerScreen: FC = () => {
    const { t } = useTranslation(['screens', 'common']);
    const { theme } = useUnistyles();

    const params = useLocalSearchParams<{
        exerciseId?: string | string[];
        startedAt?: string | string[];
    }>();

    const exerciseId = normalizeParam(params.exerciseId);
    const startedAtParam = normalizeParam(params.startedAt);
    const [startedAtMs] = useState(() => Number(startedAtParam) || Date.now());

    const { data: exercise } = useExercise(exerciseId);

    // Ticking once a second is enough for a readout in whole seconds.
    const { nowMs } = useRestTicker(true);

    const elapsedSeconds = useMemo(
        () => Math.max(0, Math.floor((nowMs - startedAtMs) / 1000)),
        [nowMs, startedAtMs],
    );

    const gifFilename = exercise?.gifFilename;

    const gifUrl = useMemo(() => {
        if (!gifFilename) return '';
        return buildExerciseGifUrl(gifFilename, EXERCISE_GIF_PREVIEW_RESOLUTION);
    }, [gifFilename]);

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <VStack style={styles.header}>
                <Text fontSize="xs" style={styles.muted}>
                    {t('timer.inProgress', { ns: 'screens' })}
                </Text>
                <Title type="h2">{exercise?.name ?? ''}</Title>
            </VStack>

            <VStack style={styles.timerPanel}>
                <Title type="h1" style={styles.timerValue}>
                    {formatDuration(elapsedSeconds)}
                </Title>
                <Text fontSize="xs" style={styles.muted}>
                    {t('timer.elapsed', { ns: 'screens' })}
                </Text>
            </VStack>

            {gifUrl ? (
                <VStack style={styles.mediaPanel}>
                    <ExpoImage
                        source={{ uri: gifUrl }}
                        style={styles.media}
                        contentFit="contain"
                        autoplay
                    />
                    <Text fontSize="2xs" style={styles.attribution}>
                        {EXERCISE_MEDIA_ATTRIBUTION}
                    </Text>
                </VStack>
            ) : null}

            {exercise ? <Guide exercise={exercise} /> : null}

            <HStack style={styles.actions}>
                <Button
                    title={t('timer.done', { ns: 'screens' })}
                    onPress={() => router.back()}
                    containerStyle={{ backgroundColor: theme.colors.foreground }}
                    textStyle={{ color: theme.colors.typography }}
                />
            </HStack>
        </ScrollView>
    );
};

export default TimerScreen;
