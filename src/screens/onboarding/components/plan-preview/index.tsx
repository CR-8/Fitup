import { FC, useMemo } from 'react';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import dayjs from 'dayjs';

import { Button } from '@/components/buttons/base';
import { Box } from '@/components/primitives/box';
import { HStack } from '@/components/primitives/hstack';
import { Text } from '@/components/primitives/text';
import { Title } from '@/components/typography/title';
import { VStack } from '@/components/primitives/vstack';
import { ScrollView } from '@/components/primitives/scrollview';
import type { AiPlanSelect } from '@/db/schema';

const HERO_PHOTO = require('../../../../../assets/images/placeholders/hero-gym.jpg');

const styles = StyleSheet.create((theme, rt) => ({
    container: {
        flex: 1,
    },
    content: {
        paddingHorizontal: theme.space(6),
        paddingTop: rt.insets.top + theme.space(8),
        paddingBottom: theme.space(4),
        gap: theme.space(5),
    },
    subtitle: {
        ...theme.fontSize.default,
        color: theme.colors.mutedTypography,
    },
    hero: {
        overflow: 'hidden',
        borderRadius: theme.radius['2xl'],
        borderCurve: 'continuous',
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.foreground,
    },
    photo: {
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
    },
    heroContent: {
        padding: theme.space(4),
        paddingTop: theme.space(14),
        gap: theme.space(1),
    },
    heroTitle: {
        ...theme.fontSize.xl,
        fontWeight: theme.fontWeight.bold.fontWeight,
        color: theme.colors.white,
    },
    heroMeta: {
        ...theme.fontSize.sm,
        color: theme.colors.neutral[300],
    },
    sectionTitle: {
        ...theme.fontSize.lg,
        fontWeight: theme.fontWeight.bold.fontWeight,
        color: theme.colors.typography,
    },
    session: {
        alignItems: 'center',
        gap: theme.space(3),
        minHeight: theme.space(14),
        backgroundColor: theme.colors.foreground,
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: theme.colors.border,
        paddingHorizontal: theme.space(4),
        paddingVertical: theme.space(3),
    },
    day: {
        ...theme.typography.eyebrow,
        width: theme.space(10),
        color: theme.colors.mutedTypography,
    },
    sessionText: {
        flex: 1,
        gap: theme.space(0.5),
    },
    sessionName: {
        ...theme.fontSize.default,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: theme.colors.typography,
    },
    sessionMeta: {
        ...theme.fontSize.sm,
        color: theme.colors.mutedTypography,
    },
    footer: {
        gap: theme.space(3),
        paddingHorizontal: theme.space(6),
        paddingTop: theme.space(3),
        paddingBottom: rt.insets.bottom + theme.space(4),
    },
}));

type PlanPreviewProps = {
    plan: AiPlanSelect;
    goalLabel: string;
    regenerationsLeft: number;
    busy: boolean;
    onUse: () => void;
    onRegenerate: () => void;
};

/**
 * The plan Syn built, before it touches the schedule. Every number on it is read
 * from the payload: the length from `horizonDays`, the weekly count from how
 * many sessions it actually contains, and the list is week one's real sessions.
 */
export const PlanPreview: FC<PlanPreviewProps> = ({
    plan,
    goalLabel,
    regenerationsLeft,
    busy,
    onUse,
    onRegenerate,
}) => {
    const { t } = useTranslation('screens');
    const payload = plan.payload;

    const { weeks, perWeek, weekOne } = useMemo(() => {
        const weekCount = Math.max(1, Math.ceil(payload.horizonDays / 7));
        const sessions = payload.workouts.filter((workout) => workout.exercises.length > 0);

        return {
            weeks: weekCount,
            perWeek: Math.max(1, Math.round(sessions.length / weekCount)),
            weekOne: sessions
                .filter((workout) => workout.dayOffset < 7)
                .sort((a, b) => a.dayOffset - b.dayOffset),
        };
    }, [payload]);

    return (
        <VStack style={styles.container}>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <VStack style={{ gap: 4 }}>
                    <Title type="h2">{t('onboarding.preview.title')}</Title>
                    <Text style={styles.subtitle}>{t('onboarding.preview.subtitle')}</Text>
                </VStack>

                <VStack style={styles.hero}>
                    <Image
                        source={HERO_PHOTO}
                        style={styles.photo}
                        contentFit="cover"
                        accessibilityIgnoresInvertColors
                    />
                    <LinearGradient
                        colors={['rgba(8, 9, 11, 0.35)', 'rgba(8, 9, 11, 0.95)']}
                        style={styles.photo}
                    />
                    <VStack style={styles.heroContent}>
                        <Text style={styles.heroTitle}>{payload.title}</Text>
                        <Text style={styles.heroMeta}>
                            {t('onboarding.preview.meta', {
                                weeks,
                                goal: goalLabel,
                                days: perWeek,
                            })}
                        </Text>
                    </VStack>
                </VStack>

                <Text style={styles.sectionTitle}>{t('onboarding.preview.weekOne')}</Text>
                <VStack style={{ gap: 8 }}>
                    {weekOne.map((workout, index) => (
                        <HStack key={`${workout.name}-${index}`} style={styles.session}>
                            <Text style={styles.day}>
                                {dayjs().add(workout.dayOffset, 'day').format('ddd')}
                            </Text>
                            <VStack style={styles.sessionText}>
                                <Text style={styles.sessionName} numberOfLines={1}>
                                    {workout.name}
                                </Text>
                                <Text style={styles.sessionMeta}>
                                    {t('home.upNext.exerciseCount', {
                                        count: workout.exercises.length,
                                    })}
                                </Text>
                            </VStack>
                        </HStack>
                    ))}
                </VStack>
            </ScrollView>

            <VStack style={styles.footer}>
                <Button
                    type="primary"
                    title={t('onboarding.preview.use')}
                    loading={busy}
                    onPress={onUse}
                />
                <Button
                    type="outline"
                    title={t('onboarding.preview.regenerate', { count: regenerationsLeft })}
                    disabled={busy || regenerationsLeft <= 0}
                    onPress={onRegenerate}
                />
            </VStack>
        </VStack>
    );
};
