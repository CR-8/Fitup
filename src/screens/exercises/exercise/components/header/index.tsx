import { useMemo, useRef, useState } from 'react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { Image as ExpoImage } from 'expo-image';
import Reanimated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Play } from 'lucide-react-native';

import { Title } from '@/components/typography/title';
import { Box } from '@/components/primitives/box';
import { Text } from '@/components/primitives/text';
import { ExerciseSelect } from '@/db/schema';
import { VStack } from '@/components/primitives/vstack';
import { HStack } from '@/components/primitives/hstack';
import { Pressable } from '@/components/primitives/pressable';
import { FavoriteButton } from '@/components/buttons/favorite';
import { normalizeMuscleValues } from '@/constants/muscles';
import { exerciseDisplayName } from '@/helpers/exercise-name';
import {
    buildExerciseGifUrl,
    EXERCISE_GIF_PREVIEW_RESOLUTION,
    EXERCISE_MEDIA_ATTRIBUTION,
} from '@/constants/fitup';

interface HeaderProps {
    exercise: ExerciseSelect;
}

const styles = StyleSheet.create((theme, rt) => ({
    wrapper: {
        paddingHorizontal: theme.space(4),
    },
    container: {
        padding: theme.space(5),
        backgroundColor: theme.colors.white,
        borderRadius: theme.radius['4xl'],
        borderColor: theme.colors.border,
        borderWidth: rt.themeName === 'dark' ? 0 : StyleSheet.hairlineWidth,
        gap: theme.space(5),
    },
    titleRow: {
        alignItems: 'flex-start',
        gap: theme.space(2),
    },
    title: {
        flex: 1,
        color: theme.colors.neutral[950],
    },
    // Centred over the frozen frame while paused. Dark and translucent because
    // the animations sit on their own white ground.
    playOverlay: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        marginTop: -theme.space(8),
        marginLeft: -theme.space(8),
        height: theme.space(16),
        width: theme.space(16),
        borderRadius: theme.radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(11, 11, 12, 0.6)',
    },
    infoContainer: {
        gap: theme.space(2),
    },
    muscleGroupsContainer: {
        flexWrap: 'wrap',
        gap: theme.space(2),
    },
    muscleGroupValueContainer: {
        paddingHorizontal: theme.space(3),
        paddingVertical: theme.space(0.5),
        backgroundColor: theme.colors.neutral[950],
        borderRadius: theme.radius['full'],
    },
    muscleGroupValue: {
        color: theme.colors.white,
        fontSize: theme.fontSize.sm.fontSize,
        fontWeight: theme.fontWeight.default.fontWeight,
    },
    exerciseTrackingGroupValue: {
        color: theme.colors.neutral[950],
        fontSize: theme.fontSize.sm.fontSize,
        fontWeight: theme.fontWeight.default.fontWeight,
    },
    gifImage: {
        width: '100%',
    },
    // The media licence requires this notice wherever the animation is shown.
    attribution: {
        color: theme.colors.neutral[500],
        textAlign: 'center',
    },
}));

export const Header = ({ exercise }: HeaderProps) => {
    const { t } = useTranslation(['common', 'screens']);
    const { theme } = useUnistyles();
    const primaryMuscleGroups = normalizeMuscleValues(exercise.primaryMuscleGroups) || [];
    const [aspectRatio, setAspectRatio] = useState<number>(1);
    const imageRef = useRef<ExpoImage>(null);
    const [paused, setPaused] = useState(false);

    // Still autoplays: an exercise is understood by watching it move. The tap is
    // for holding a frame to study the position, which a looping GIF never lets
    // anyone do.
    const togglePlayback = () => {
        if (paused) imageRef.current?.startAnimating();
        else imageRef.current?.stopAnimating();
        setPaused(!paused);
    };

    const gifUrl = useMemo(() => {
        if (!exercise.gifFilename) return null;
        return buildExerciseGifUrl(exercise.gifFilename, EXERCISE_GIF_PREVIEW_RESOLUTION);
    }, [exercise.gifFilename]);

    return (
        <Box style={styles.wrapper}>
            <VStack style={styles.container}>
                <HStack style={styles.titleRow}>
                    <Title type="h3" style={styles.title}>
                        {exerciseDisplayName(exercise)}
                    </Title>
                    <FavoriteButton exerciseId={exercise.id} size={theme.space(6)} />
                </HStack>
                {gifUrl && (
                    <Pressable
                        onPress={togglePlayback}
                        animateOnPress={false}
                        accessibilityRole="button"
                        accessibilityLabel={t(paused ? 'exercise.play' : 'exercise.pause', {
                            ns: 'screens',
                        })}
                    >
                        <ExpoImage
                            ref={imageRef}
                            source={{ uri: gifUrl }}
                            style={[styles.gifImage, { aspectRatio }]}
                            contentFit="contain"
                            autoplay
                            onLoad={(e) => setAspectRatio(e.source.width / e.source.height)}
                        />
                        {paused ? (
                            <Reanimated.View
                                entering={FadeIn.duration(160)}
                                exiting={FadeOut.duration(120)}
                                style={styles.playOverlay}
                                pointerEvents="none"
                            >
                                <Play
                                    size={theme.space(7)}
                                    color={theme.colors.white}
                                    fill={theme.colors.white}
                                />
                            </Reanimated.View>
                        ) : null}
                    </Pressable>
                )}
                {gifUrl && (
                    <Text fontSize="2xs" style={styles.attribution}>
                        {EXERCISE_MEDIA_ATTRIBUTION}
                    </Text>
                )}
                {(exercise.tracking || primaryMuscleGroups.length > 0) && (
                    <VStack style={styles.infoContainer}>
                        {exercise.tracking && (
                            <Box>
                                <Text style={styles.exerciseTrackingGroupValue}>
                                    {exercise.tracking
                                        .map((v) => t(`exerciseTracking.${v}`, { ns: 'common' }))
                                        .join(' + ')}
                                </Text>
                            </Box>
                        )}
                        {primaryMuscleGroups.length > 0 && (
                            <HStack style={styles.muscleGroupsContainer}>
                                {primaryMuscleGroups.map((muscleGroup) => (
                                    <Box key={muscleGroup} style={styles.muscleGroupValueContainer}>
                                        <Text style={styles.muscleGroupValue}>
                                            {t(`muscleGroup.${muscleGroup}`, { ns: 'common' })}
                                        </Text>
                                    </Box>
                                ))}
                            </HStack>
                        )}
                    </VStack>
                )}
            </VStack>
        </Box>
    );
};
