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

const styles = StyleSheet.create((theme, rt) => ({
    container: {
        flex: 1,
        paddingHorizontal: theme.space(4),
    },
    content: {
        paddingTop: theme.screenHeaderHeight(),
        paddingBottom: rt.insets.bottom + theme.space(4),
        gap: theme.space(5),
        flexGrow: 1,
    },
    progressRow: {
        gap: theme.space(2),
    },
    progressSegment: (filled: boolean) => ({
        flex: 1,
        height: theme.space(1),
        borderRadius: theme.radius.full,
        backgroundColor: filled ? theme.colors.brand[500] : theme.colors.foreground,
    }),
    intro: {
        gap: theme.space(2),
    },
    muted: {
        color: theme.colors.neutral[400],
    },
    // Fields sit on `foreground` so the `background`-filled inputs inside read as
    // distinct controls rather than merging into the surface.
    panel: {
        backgroundColor: theme.colors.foreground,
        borderRadius: theme.radius['4xl'],
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
 * The scroll view is keyboard-aware, so a field near the bottom is never left
 * under the keyboard — the reason the single long form was awkward to fill in.
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
    const { t } = useTranslation(['screens']);
    const { theme, rt } = useUnistyles();

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
                <Title type="h2">{title}</Title>
                {subtitle ? (
                    <Text fontSize="sm" style={styles.muted}>
                        {subtitle}
                    </Text>
                ) : null}
            </VStack>

            <VStack style={styles.panel}>{children}</VStack>

            <Box style={styles.spacer} />

            <VStack style={styles.actions}>
                <Button
                    title={nextLabel}
                    loading={isSubmitting}
                    onPress={onNext}
                    spinnerColor={
                        rt.themeName === 'dark'
                            ? theme.colors.neutral[950]
                            : theme.colors.neutral[50]
                    }
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
