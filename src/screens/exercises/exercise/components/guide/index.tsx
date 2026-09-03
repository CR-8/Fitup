import { FC, useMemo, useState } from 'react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { Image as ExpoImage } from 'expo-image';
import { XIcon } from 'lucide-react-native';

import { Box } from '@/components/primitives/box';
import { VStack } from '@/components/primitives/vstack';
import { HStack } from '@/components/primitives/hstack';
import { Text } from '@/components/primitives/text';
import { Title } from '@/components/typography/title';
import { ExerciseSelect } from '@/db/schema';
import { equipmentTranslationKey } from '@/constants/equipment';
import { sanitizeMuscleGroupSelections } from '@/constants/muscles';
import {
    buildExerciseGifUrl,
    EXERCISE_GIF_PREVIEW_RESOLUTION,
    EXERCISE_MEDIA_ATTRIBUTION,
} from '@/constants/fitup';

/**
 * What a user reads mid-set when they do not know the movement.
 *
 * It used to render three things — a description, a numbered list, and a red
 * card of common mistakes — and for the 1,324 exercises in the catalogue two of
 * those are always empty: the dataset carries neither field. So the guide was a
 * wall of sentences, while the animation that actually shows the movement sat
 * unused on the same row.
 *
 * The animation leads now, because it is the fastest way to answer the question
 * the screen exists for. The description and mistakes blocks stay for
 * user-authored exercises, which can have them.
 */

interface GuideProps {
    exercise: ExerciseSelect;
    /**
     * The exercise detail screen already shows the same animation in its header,
     * directly above the tab this renders in, so it opts out rather than showing
     * the movement twice on one screen.
     */
    showHero?: boolean;
}

const styles = StyleSheet.create((theme, rt) => ({
    container: {
        paddingHorizontal: theme.space(4),
        gap: theme.space(10),
    },
    section: {
        gap: theme.space(4),
    },
    sectionContent: {
        gap: theme.space(4),
    },
    sectionTitle: {
        color: theme.colors.typography,
        fontSize: theme.fontSize['2xl'].fontSize,
        fontWeight: theme.fontWeight.bold.fontWeight,
    },

    // Hero — the animation, on white in both themes because that is the ground
    // the media itself is drawn on.
    hero: {
        backgroundColor: theme.colors.white,
        borderRadius: theme.radius['4xl'],
        borderColor: theme.colors.border,
        borderWidth: rt.themeName === 'dark' ? 0 : StyleSheet.hairlineWidth,
        padding: theme.space(5),
        gap: theme.space(5),
    },
    heroTitle: {
        color: theme.colors.neutral[950],
    },
    heroImage: {
        width: '100%',
    },
    // The media licence requires this notice wherever the animation is shown.
    attribution: {
        color: theme.colors.neutral[500],
        textAlign: 'center',
    },

    chipRow: {
        flexWrap: 'wrap',
        gap: theme.space(2),
    },
    chip: {
        paddingHorizontal: theme.space(3),
        paddingVertical: theme.space(1),
        borderRadius: theme.radius.full,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: theme.colors.border,
    },
    chipText: {
        color: theme.colors.typography,
        fontSize: theme.fontSize.sm.fontSize,
        lineHeight: theme.fontSize.sm.lineHeight,
    },
    // Primary muscles are filled so the split between what the movement trains
    // and what merely assists is visible without reading a label for it.
    chipPrimary: {
        backgroundColor: theme.colors.typography,
        borderColor: theme.colors.typography,
    },
    chipPrimaryText: {
        color: theme.colors.background,
    },
    chipSecondaryText: {
        opacity: 0.7,
    },

    description: {
        color: theme.colors.typography,
        lineHeight: 22,
    },

    stepsCard: {
        backgroundColor: theme.colors.foreground,
        borderRadius: theme.radius['4xl'],
        padding: theme.space(5),
    },
    stepRow: {
        gap: theme.space(3),
    },
    stepNumber: {
        width: theme.space(7),
        height: theme.space(7),
        borderRadius: theme.radius.full,
        backgroundColor: theme.colors.background,
        alignItems: 'center',
        justifyContent: 'center',
    },
    stepNumberText: {
        color: theme.colors.typography,
        fontSize: theme.fontSize.sm.fontSize,
        fontWeight: theme.fontWeight.semibold.fontWeight,
    },
    stepContent: {
        flex: 1,
        flexShrink: 1,
    },
    stepText: {
        color: theme.colors.typography,
        lineHeight: 22,
    },
    // Starts under the text rather than under the disc: 28 + 12.
    stepDivider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: theme.colors.border,
        marginTop: theme.space(4),
        marginLeft: theme.space(10),
    },

    mistakeSection: {
        backgroundColor: theme.colors.red[500],
        borderRadius: theme.radius['4xl'],
        padding: theme.space(5),
    },
    mistakeRow: {
        alignItems: 'center',
    },
    mistakeIconContainer: {
        width: theme.space(8),
        alignItems: 'flex-start',
    },
    mistakeTitle: {
        color: theme.colors.white,
    },
    mistakeText: {
        color: theme.colors.white,
        lineHeight: 22,
        flex: 1,
        flexShrink: 1,
    },
    mistakeDivider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: theme.colors.red[100],
        opacity: 0.3,
        marginTop: theme.space(4),
        marginLeft: theme.space(8),
    },

    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: theme.space(8),
        paddingTop: theme.space(10),
        paddingBottom: rt.insets.bottom === 0 ? theme.space(10) : rt.insets.bottom,
        gap: theme.space(2),
    },
    emptyTitle: {
        color: theme.colors.typography,
        fontSize: theme.fontSize.xl.fontSize,
        fontWeight: theme.fontWeight.bold.fontWeight,
    },
    emptyDescription: {
        color: theme.colors.typography,
        opacity: 0.6,
        textAlign: 'center',
    },
}));

export const Guide: FC<GuideProps> = ({ exercise, showHero = true }) => {
    const { t } = useTranslation(['screens', 'common']);
    const { theme } = useUnistyles();
    const [aspectRatio, setAspectRatio] = useState(1);

    const gifUrl = useMemo(() => {
        if (!exercise.gifFilename) return null;
        return buildExerciseGifUrl(exercise.gifFilename, EXERCISE_GIF_PREVIEW_RESOLUTION) || null;
    }, [exercise.gifFilename]);

    // Equipment and tracking answer "what do I need" and "what do I log", which
    // is what people check before they read a single step.
    const facts = useMemo(() => {
        const values: string[] = [t(`exerciseCategory.${exercise.category}`, { ns: 'common' })];

        for (const item of exercise.equipment ?? []) {
            values.push(t(`equipment.${equipmentTranslationKey(item)}`, { ns: 'common' }));
        }

        if (exercise.tracking?.length) {
            values.push(
                exercise.tracking
                    .map((v) => t(`exerciseTracking.${v}`, { ns: 'common' }))
                    .join(' + '),
            );
        }

        return values;
    }, [exercise.category, exercise.equipment, exercise.tracking, t]);

    // Drops any secondary that a primary already covers, so a muscle is never
    // shown twice with two different weights.
    const { primary, secondary } = useMemo(
        () =>
            sanitizeMuscleGroupSelections({
                primary: exercise.primaryMuscleGroups,
                secondary: exercise.secondaryMuscleGroups,
            }),
        [exercise.primaryMuscleGroups, exercise.secondaryMuscleGroups],
    );

    const hasDescription = !!exercise.description;
    const hasInstructions = !!exercise.instructions && exercise.instructions.length > 0;
    const hasMistakes = !!exercise.mistakes && exercise.mistakes.length > 0;
    const hasHero = showHero && !!gifUrl;
    const hasMuscles = !!primary?.length || !!secondary?.length;

    if (!hasHero && !hasDescription && !hasInstructions && !hasMistakes && !hasMuscles) {
        return (
            <VStack style={styles.emptyContainer}>
                <Text style={styles.emptyTitle}>
                    {t('exercise.guide.empty.title', { ns: 'screens' })}
                </Text>
                <Text style={styles.emptyDescription}>
                    {t('exercise.guide.empty.description', { ns: 'screens' })}
                </Text>
            </VStack>
        );
    }

    return (
        <VStack style={styles.container}>
            {hasHero && (
                <VStack style={styles.hero}>
                    <Title type="h3" style={styles.heroTitle}>
                        {exercise.name}
                    </Title>
                    <ExpoImage
                        source={{ uri: gifUrl! }}
                        style={[styles.heroImage, { aspectRatio }]}
                        contentFit="contain"
                        autoplay
                        onLoad={(e) => setAspectRatio(e.source.width / e.source.height)}
                    />
                    <Text fontSize="2xs" style={styles.attribution}>
                        {EXERCISE_MEDIA_ATTRIBUTION}
                    </Text>
                </VStack>
            )}

            <HStack style={styles.chipRow}>
                {facts.map((fact) => (
                    <Box key={fact} style={styles.chip}>
                        <Text style={styles.chipText}>{fact}</Text>
                    </Box>
                ))}
            </HStack>

            {hasMuscles && (
                <VStack style={styles.section}>
                    <Text style={styles.sectionTitle}>
                        {t('exercise.guide.muscles', { ns: 'screens' })}
                    </Text>
                    <HStack style={styles.chipRow}>
                        {primary?.map((value) => (
                            <Box key={value} style={[styles.chip, styles.chipPrimary]}>
                                <Text style={[styles.chipText, styles.chipPrimaryText]}>
                                    {t(`muscleGroup.${value}`, { ns: 'common' })}
                                </Text>
                            </Box>
                        ))}
                        {secondary?.map((value) => (
                            <Box key={value} style={styles.chip}>
                                <Text style={[styles.chipText, styles.chipSecondaryText]}>
                                    {t(`muscleGroup.${value}`, { ns: 'common' })}
                                </Text>
                            </Box>
                        ))}
                    </HStack>
                </VStack>
            )}

            {hasDescription && (
                <VStack style={styles.section}>
                    <Text style={styles.description}>{exercise.description}</Text>
                </VStack>
            )}

            {hasInstructions && (
                <VStack style={[styles.section, styles.stepsCard]}>
                    <Text style={styles.sectionTitle}>
                        {t('exercise.guide.steps', { ns: 'screens' })}
                    </Text>
                    <VStack style={styles.sectionContent}>
                        {exercise.instructions!.map((instruction, index, arr) => (
                            <HStack key={index} style={styles.stepRow}>
                                <Box style={styles.stepNumber}>
                                    <Text style={styles.stepNumberText}>{index + 1}</Text>
                                </Box>
                                <VStack style={styles.stepContent}>
                                    <Text style={styles.stepText}>{instruction}</Text>
                                    {index < arr.length - 1 && <Box style={styles.stepDivider} />}
                                </VStack>
                            </HStack>
                        ))}
                    </VStack>
                </VStack>
            )}

            {hasMistakes && (
                <VStack style={[styles.section, styles.mistakeSection]}>
                    <Text style={[styles.sectionTitle, styles.mistakeTitle]}>
                        {t('exercise.guide.mistakes', { ns: 'screens' })}
                    </Text>
                    <VStack style={styles.sectionContent}>
                        {exercise.mistakes!.map((mistake, index, arr) => (
                            <VStack key={index}>
                                <HStack style={styles.mistakeRow}>
                                    <Box style={styles.mistakeIconContainer}>
                                        <XIcon size={18} color={theme.colors.white} />
                                    </Box>
                                    <Text style={styles.mistakeText}>
                                        {mistake.endsWith('.') ? mistake : `${mistake}.`}
                                    </Text>
                                </HStack>
                                {index < arr.length - 1 && <Box style={styles.mistakeDivider} />}
                            </VStack>
                        ))}
                    </VStack>
                </VStack>
            )}
        </VStack>
    );
};
