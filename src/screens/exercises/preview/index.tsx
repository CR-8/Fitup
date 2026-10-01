import { FC, useMemo } from 'react';
import { StyleSheet } from 'react-native-unistyles';
import { router, useLocalSearchParams } from 'expo-router';
import { Image as ExpoImage } from 'expo-image';
import { useTranslation } from 'react-i18next';

import { Box } from '@/components/primitives/box';
import { Text } from '@/components/primitives/text';
import {
    buildExerciseGifUrl,
    EXERCISE_GIF_PREVIEW_RESOLUTION,
    EXERCISE_MEDIA_ATTRIBUTION,
} from '@/constants/fitup';

import { Stack } from '@/navigators/stack';
import { HeaderTextButton } from '@/components/buttons/header';

const styles = StyleSheet.create((theme, rt) => ({
    // The animations are drawn on white, so the page is white in both themes.
    container: {
        flex: 1,
        backgroundColor: theme.colors.white,
    },
    gifContainer: {
        flex: 1,
        paddingHorizontal: theme.space(4),
        paddingVertical: theme.space(4),
        justifyContent: 'center',
    },
    gifImage: {
        width: '100%',
        height: '100%',
    },
    // The media licence requires this notice wherever the animation is shown.
    attribution: {
        paddingHorizontal: theme.space(4),
        paddingBottom: rt.insets.bottom + theme.space(3),
        textAlign: 'center',
        // On the white matte in both themes.
        color: theme.colors.neutral[500],
    },
}));

const normalizeParam = (value: string | string[] | undefined): string => {
    if (Array.isArray(value)) {
        return value[0] ?? '';
    }
    return value ?? '';
};

const PreviewScreen: FC = () => {
    const { t } = useTranslation(['common']);
    const { gifFilename, name } = useLocalSearchParams<{
        gifFilename?: string | string[];
        name?: string;
    }>();

    const gifUrl = useMemo(() => {
        const filename = normalizeParam(gifFilename);
        if (!filename) return '';
        return buildExerciseGifUrl(filename, EXERCISE_GIF_PREVIEW_RESOLUTION);
    }, [gifFilename]);

    const handleClose = () => {
        router.back();
    };

    return (
        <Box style={styles.container}>
            <Stack.Screen
                options={{
                    title: name ?? '',
                    headerRight: () => (
                        <HeaderTextButton
                            title={t('done', { ns: 'common' })}
                            onPress={handleClose}
                            prominent
                        />
                    ),
                }}
            />
            {gifUrl ? (
                <>
                    <Box style={styles.gifContainer}>
                        <ExpoImage
                            source={{ uri: gifUrl }}
                            style={styles.gifImage}
                            contentFit="contain"
                            autoplay
                        />
                    </Box>
                    <Text fontSize="2xs" style={styles.attribution}>
                        {EXERCISE_MEDIA_ATTRIBUTION}
                    </Text>
                </>
            ) : null}
        </Box>
    );
};

export default PreviewScreen;
