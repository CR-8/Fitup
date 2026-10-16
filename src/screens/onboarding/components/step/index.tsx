import { FC, ReactNode } from 'react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { VStack } from '@/components/primitives/vstack';
import { HStack } from '@/components/primitives/hstack';
import { Box } from '@/components/primitives/box';
import { Text } from '@/components/primitives/text';
import { Title } from '@/components/typography/title';
import { Button } from '@/components/buttons/base';
import { Pressable } from '@/components/primitives/pressable';
import { Icon } from '@/components/primitives/icon';

const styles = StyleSheet.create((theme, rt) => ({
    container: {
        flex: 1,
        paddingHorizontal: theme.space(6),
    },
    content: {
        paddingTop: rt.insets.top + theme.space(3),
        paddingBottom: rt.insets.bottom + theme.space(4),
        gap: theme.space(5),
        flexGrow: 1,
    },
    topRow: {
        alignItems: 'center',
        justifyContent: 'space-between',
        minHeight: theme.space(11),
    },
    back: {
        height: theme.space(11),
        width: theme.space(11),
        marginLeft: -theme.space(3),
        alignItems: 'center',
        justifyContent: 'center',
    },
    progressRow: {
        flex: 1,
        gap: theme.space(1.5),
        marginHorizontal: theme.space(2),
    },
    /** Steps behind you and the one you are on are brand red; the rest are quiet. */
    progressSegment: (filled: boolean) => ({
        flex: 1,
        height: theme.space(1),
        borderRadius: theme.radius.full,
        backgroundColor: filled ? theme.colors.brand[500] : theme.colors.elevated,
    }),
    // The reference's setup screens: a large centred title over one short
    // paragraph, then the questions.
    heading: {
        alignItems: 'center',
        gap: theme.space(2),
        paddingHorizontal: theme.space(2),
    },
    title: {
        textAlign: 'center',
    },
    muted: {
        ...theme.fontSize.default,
        textAlign: 'center',
        color: theme.colors.mutedTypography,
    },
    spacer: {
        flex: 1,
        minHeight: theme.space(4),
    },
    actions: {
        gap: theme.space(2),
    },
    skip: {
        minHeight: theme.space(11),
        alignItems: 'center',
        justifyContent: 'center',
    },
    skipText: {
        ...theme.fontSize.sm,
        color: theme.colors.mutedTypography,
    },
}));

interface StepProps {
    stepIndex: number;
    stepCount: number;
    title: string;
    subtitle?: string;
    children: ReactNode;
    onNext: () => void;
    onBack?: () => void;
    onSkip?: () => void;
    nextLabel: string;
    isSubmitting?: boolean;
}

/**
 * One onboarding question group: a back arrow, a thin progress bar, a large
 * centred heading, the fields, and one filled Continue button at the bottom.
 * Fields sit directly on the page.
 *
 * The scroll view is keyboard-aware, so a field near the bottom is never left
 * under the keyboard.
 */
export const OnboardingStep: FC<StepProps> = ({
    stepIndex,
    stepCount,
    title,
    subtitle,
    children,
    onNext,
    onBack,
    onSkip,
    nextLabel,
    isSubmitting = false,
}) => {
    const { t } = useTranslation(['screens', 'common']);
    const { theme } = useUnistyles();

    return (
        <KeyboardAwareScrollView
            style={styles.container}
            contentContainerStyle={styles.content}
            bottomOffset={theme.space(20)}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
        >
            <HStack style={styles.topRow}>
                {onBack ? (
                    <Pressable
                        style={styles.back}
                        onPress={onBack}
                        accessibilityRole="button"
                        accessibilityLabel={t('back', { ns: 'common' })}
                    >
                        <Icon name="chevron-left" size={theme.space(6)} />
                    </Pressable>
                ) : (
                    <Box style={styles.back} />
                )}
                <HStack
                    style={styles.progressRow}
                    accessibilityRole="progressbar"
                    accessibilityLabel={t('onboarding.stepCounter', {
                        ns: 'screens',
                        current: stepIndex + 1,
                        total: stepCount,
                    })}
                >
                    {Array.from({ length: stepCount }).map((_, index) => (
                        <Box key={index} style={styles.progressSegment(index <= stepIndex)} />
                    ))}
                </HStack>
                <Box style={styles.back} />
            </HStack>

            <VStack style={styles.heading}>
                <Title type="h1" style={styles.title} accessibilityRole="header">
                    {title}
                </Title>
                {subtitle ? <Text style={styles.muted}>{subtitle}</Text> : null}
            </VStack>

            {children}

            <Box style={styles.spacer} />

            <VStack style={styles.actions}>
                <Button
                    title={nextLabel}
                    type="primary"
                    loading={isSubmitting}
                    onPress={onNext}
                    spinnerColor={theme.solid.primaryTypography}
                />
                {onSkip ? (
                    <Pressable style={styles.skip} onPress={onSkip} accessibilityRole="button">
                        <Text style={styles.skipText}>
                            {t('onboarding.skip', { ns: 'screens' })}
                        </Text>
                    </Pressable>
                ) : null}
            </VStack>
        </KeyboardAwareScrollView>
    );
};
