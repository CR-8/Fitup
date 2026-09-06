import { FC, memo, useCallback, useMemo } from 'react';
import { GestureResponderEvent } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Image as ExpoImage } from 'expo-image';
import { Play } from 'lucide-react-native';

import { Box, BoxProps } from '@/components/primitives/box';
import { Pressable } from '@/components/primitives/pressable';
import { buildExerciseGifUrl, EXERCISE_GIF_THUMBNAIL_RESOLUTION } from '@/constants/fitup';
import { useAnalytics } from '@/hooks/use-analytics';

const styles = StyleSheet.create((theme) => ({
    gifPreviewPressable: {
        width: theme.space(12),
        height: theme.space(12),
        marginRight: theme.space(4),
        borderRadius: theme.space(2),
        overflow: 'hidden',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.background,
    },
    gifPreviewImage: {
        width: '100%',
        height: '100%',
    },
    /**
     * These render with `autoplay={false}`, so an animated exercise sits here
     * as a single frozen frame and looks like a plain still. The badge is the
     * only thing telling anyone there is an animation behind it — and it is
     * drawn only when a GIF actually exists, so it never promises playback the
     * exercise does not have.
     */
    playBadge: {
        position: 'absolute',
        right: theme.space(0.5),
        bottom: theme.space(0.5),
        height: theme.space(4),
        width: theme.space(4),
        borderRadius: theme.radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(11, 11, 12, 0.65)',
    },
}));

interface PreviewThumbnailProps {
    name: string;
    gifFilename?: string | null;
    onOpen?: (name: string, gifFilename: string) => void;
    containerStyle?: BoxProps['style'];
    analyticsSurface?: 'exercise_library' | 'workout_select' | 'active_workout';
    analyticsWorkoutId?: string;
}

const PreviewThumbnailComponent: FC<PreviewThumbnailProps> = ({
    name,
    gifFilename,
    onOpen,
    containerStyle,
    analyticsSurface,
    analyticsWorkoutId,
}) => {
    const { track } = useAnalytics();
    const { theme } = useUnistyles();
    const gifThumbnailUrl = useMemo(() => {
        if (!gifFilename) return '';
        return buildExerciseGifUrl(gifFilename, EXERCISE_GIF_THUMBNAIL_RESOLUTION);
    }, [gifFilename]);

    const handlePress = useCallback(
        (event: GestureResponderEvent) => {
            if (!gifFilename) return;
            event.stopPropagation();
            if (analyticsSurface) {
                track('exercise:preview_opened', {
                    surface: analyticsSurface,
                    workoutId: analyticsWorkoutId,
                });
            }
            onOpen?.(name, gifFilename);
        },
        [analyticsSurface, analyticsWorkoutId, gifFilename, name, onOpen, track],
    );

    if (!gifThumbnailUrl) return null;

    return (
        <Pressable
            onPress={handlePress}
            hitSlop={8}
            style={[styles.gifPreviewPressable, containerStyle]}
        >
            <ExpoImage
                source={{ uri: gifThumbnailUrl }}
                style={styles.gifPreviewImage}
                contentFit="cover"
                autoplay={false}
            />
            <Box style={styles.playBadge}>
                <Play
                    size={theme.space(2)}
                    color={theme.colors.white}
                    fill={theme.colors.white}
                    strokeWidth={3}
                />
            </Box>
        </Pressable>
    );
};

export const PreviewThumbnail = memo(PreviewThumbnailComponent);
