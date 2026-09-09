import { FC, ReactNode } from 'react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import type { LucideIcon } from 'lucide-react-native';

import { VStack } from '@/components/primitives/vstack';
import { HStack } from '@/components/primitives/hstack';
import { Box } from '@/components/primitives/box';
import { Text } from '@/components/primitives/text';
import { Title } from '@/components/typography/title';
import { Button } from '@/components/buttons/base';
import { Pressable } from '@/components/primitives/pressable';

const styles = StyleSheet.create((theme, rt) => ({
    container: {
        flex: 1,
        paddingHorizontal: theme.space(4),
    },
    content: {
        paddingTop: rt.insets.top + theme.space(6),
        paddingBottom: rt.insets.bottom + theme.space(4),
        gap: theme.space(5),
        flexGrow: 1,
    },
    progressRow: {
        gap: theme.space(2),
    },
    /**
     * Steps behind you stay coral; the one you are on is the only one that is
     * ever partly filled, so the bar reads as ground covered rather than as a
     * row of tabs.
     */
    progressSegment: (filled: boolean) => ({
        flex: 1,
        height: theme.space(1),
        borderRadius: theme.radius.full,
        backgroundColor: filled ? theme.colors.primary : theme.colors.elevated,
    }),
    // The eyebrow/icon/title stack is the Home card vocabulary: uppercase
    // micro-label, coral-tinted glyph, then the heading.
    eyebrow: {
        ...theme.fontSize['2xs'],
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: theme.colors.mutedTypography,
    },
    intro: {
        gap: theme.space(3),
    },
    icon: {
        height: theme.space(12),
        width: theme.space(12),
        borderRadius: theme.radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.primarySoft,
    },
    heading: {
        gap: theme.space(1.5),
    },
    muted: {
        color: theme.colors.mutedTypography,
    },
    /**
     * The reason to answer, not a caption for the question.
     *
     * Coral on `primarySoft` rather than another grey line, because it is the
     * only part of the screen arguing for finishing it.
     */
    motivation: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space(3),
        backgroundColor: theme.colors.primarySoft,
        borderRadius: theme.radius['2xl'],
        paddingVertical: theme.space(3.5),
        paddingHorizontal: theme.space(4),
    },
    // `brand[700]` on the light tint and `primary` on the dark one: the same
    // ratio reasoning as the Home streak card, which sits on the same fill.
    motivationText: {
        flex: 1,
        ...theme.fontSize.sm,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: rt.themeName === 'dark' ? theme.colors.primary : theme.colors.brand[700],
    },
    // Fields sit on `foreground` so the `background`-filled inputs inside read as
    // distinct controls rather than merging into the surface.
    panel: {
        backgroundColor: theme.colors.foreground,
        borderRadius: theme.radius['3xl'],
        padding: theme.space(5),
        gap: theme.space(5),
    },
    spacer: {
        flex: 1,
        minHeight: theme.space(4),
    },
    actions: {
        gap: theme.space(2),
    },
    /**
     * Coral, like every other "do the thing" control in the app.
     *
     * `brand[600]`, not `colors.primary`: the label is 16px, which is below the
     * large-text allowance, so it has to clear 4.5:1. White on `brand[500]` is
     * 3.41:1 and on `brand[600]` is 4.48:1.
     */
    primaryAction: {
        backgroundColor: theme.colors.brand[600],
    },
    primaryActionText: {
        color: theme.colors.primaryTypography,
    },
    secondaryRow: {
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    linkButton: {
        paddingVertical: theme.space(3),
        paddingHorizontal: theme.space(2),
    },
}));

interface StepProps {
    stepIndex: number;
    stepCount: number;
    title: string;
    subtitle?: string;
    /** One line on why this step is worth answering. */
    motivation: string;
    icon: LucideIcon;
    children: ReactNode;
    onNext: () => void;
    onBack?: () => void;
    onSkip?: () => void;
    nextLabel: string;
    isSubmitting?: boolean;
}

/**
 * One onboarding question group.
 *
 * Built from the same pieces as the Home cards — uppercase eyebrow, coral glyph
 * on `primarySoft`, `foreground` panel at `3xl` — so the first screen of the app
 * looks like the rest of it rather than like a settings form.
 *
 * The scroll view is keyboard-aware, so a field near the bottom is never left
 * under the keyboard — the reason the single long form was awkward to fill in.
 */
export const OnboardingStep: FC<StepProps> = ({
    stepIndex,
    stepCount,
    title,
    subtitle,
    motivation,
    icon: Icon,
    children,
    onNext,
    onBack,
    onSkip,
    nextLabel,
    isSubmitting = false,
}) => {
    const { t } = useTranslation(['screens']);
    const { theme, rt } = useUnistyles();

    const accent = rt.themeName === 'dark' ? theme.colors.primary : theme.colors.brand[700];

    return (
        <KeyboardAwareScrollView
            style={styles.container}
            contentContainerStyle={styles.content}
            bottomOffset={theme.space(20)}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
        >
            <HStack style={styles.progressRow}>
                {Array.from({ length: stepCount }).map((_, index) => (
                    <Box key={index} style={styles.progressSegment(index <= stepIndex)} />
                ))}
            </HStack>

            <VStack style={styles.intro}>
                <Text style={styles.eyebrow}>
                    {t('onboarding.stepCounter', {
                        ns: 'screens',
                        current: stepIndex + 1,
                        total: stepCount,
                    })}
                </Text>

                <Box style={styles.icon}>
                    <Icon size={theme.space(6)} color={accent} strokeWidth={2.2} />
                </Box>

                <VStack style={styles.heading}>
                    <Title type="h2">{title}</Title>
                    {subtitle ? (
                        <Text fontSize="sm" style={styles.muted}>
                            {subtitle}
                        </Text>
                    ) : null}
                </VStack>
            </VStack>

            <Box style={styles.motivation}>
                <Text style={styles.motivationText}>{motivation}</Text>
            </Box>

            <VStack style={styles.panel}>{children}</VStack>

            <Box style={styles.spacer} />

            <VStack style={styles.actions}>
                <Button
                    title={nextLabel}
                    loading={isSubmitting}
                    onPress={onNext}
                    containerStyle={styles.primaryAction}
                    textStyle={styles.primaryActionText}
                    spinnerColor={theme.colors.primaryTypography}
                />

                <HStack style={styles.secondaryRow}>
                    {onBack ? (
                        <Pressable style={styles.linkButton} onPress={onBack}>
                            <Text fontSize="sm" style={styles.muted}>
                                {t('onboarding.back', { ns: 'screens' })}
                            </Text>
                        </Pressable>
                    ) : (
                        <Box />
                    )}

                    {onSkip ? (
                        <Pressable style={styles.linkButton} onPress={onSkip}>
                            <Text fontSize="sm" style={styles.muted}>
                                {t('onboarding.skip', { ns: 'screens' })}
                            </Text>
                        </Pressable>
                    ) : (
                        <Box />
                    )}
                </HStack>
            </VStack>
        </KeyboardAwareScrollView>
    );
};
