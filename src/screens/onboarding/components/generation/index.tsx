import { FC } from 'react';
import Svg, { Circle } from 'react-native-svg';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';

import { SynMark } from '@/components/brand/syn-mark';
import { Button } from '@/components/buttons/base';
import Spinner from '@/components/feedback/spinner';
import { Box } from '@/components/primitives/box';
import { HStack } from '@/components/primitives/hstack';
import { Icon } from '@/components/primitives/icon';
import { Text } from '@/components/primitives/text';
import { Title } from '@/components/typography/title';
import { VStack } from '@/components/primitives/vstack';
import { GENERATION_STAGES, useAiProgressStore } from '@/stores/ai-progress';

const RING = 168;
const STROKE = 6;

const styles = StyleSheet.create((theme, rt) => ({
    container: {
        flex: 1,
        paddingHorizontal: theme.space(6),
        paddingTop: rt.insets.top + theme.space(10),
        paddingBottom: rt.insets.bottom + theme.space(4),
        gap: theme.space(6),
        alignItems: 'center',
    },
    heading: {
        alignItems: 'center',
        gap: theme.space(2),
    },
    subtitle: {
        ...theme.fontSize.default,
        textAlign: 'center',
        color: theme.colors.mutedTypography,
    },
    ring: {
        height: RING,
        width: RING,
        alignItems: 'center',
        justifyContent: 'center',
    },
    ringSvg: {
        position: 'absolute',
    },
    list: {
        alignSelf: 'stretch',
        gap: theme.space(3),
    },
    row: {
        alignItems: 'center',
        gap: theme.space(3),
        minHeight: theme.space(7),
    },
    marker: {
        height: theme.space(6),
        width: theme.space(6),
        alignItems: 'center',
        justifyContent: 'center',
    },
    pendingDot: {
        height: theme.space(5),
        width: theme.space(5),
        borderRadius: theme.radius.full,
        borderWidth: 1.5,
        borderColor: theme.colors.border,
    },
    label: (state: 'done' | 'active' | 'pending') => ({
        ...theme.fontSize.default,
        color: state === 'pending' ? theme.colors.mutedTypography : theme.colors.typography,
    }),
    spacer: {
        flex: 1,
    },
    note: {
        ...theme.fontSize.sm,
        textAlign: 'center',
        color: theme.colors.mutedTypography,
    },
    actions: {
        alignSelf: 'stretch',
        gap: theme.space(3),
    },
}));

/**
 * "Syn is creating your plan". The checklist follows the generation itself: each
 * row ticks when `generatePlan` reports that stage finished, so it can stall
 * honestly on a slow reply instead of racing ahead on a timer.
 */
export const Generation: FC<{ onCancel: () => void }> = ({ onCancel }) => {
    const { t } = useTranslation('screens');
    const { theme } = useUnistyles();
    const stage = useAiProgressStore((state) => state.stage);

    const current = GENERATION_STAGES.indexOf(stage);
    const done = stage === 'done' ? GENERATION_STAGES.length : Math.max(0, current);
    const progress = done / GENERATION_STAGES.length;

    const radius = (RING - STROKE) / 2;
    const circumference = 2 * Math.PI * radius;

    return (
        <VStack style={styles.container}>
            <VStack style={styles.heading}>
                <Title type="h2" style={{ textAlign: 'center' }}>
                    {t('onboarding.generating.title')}
                </Title>
                <Text style={styles.subtitle}>{t('onboarding.generating.subtitle')}</Text>
            </VStack>

            <Box style={styles.ring} accessibilityRole="progressbar">
                <Svg width={RING} height={RING} style={styles.ringSvg}>
                    <Circle
                        cx={RING / 2}
                        cy={RING / 2}
                        r={radius}
                        stroke={theme.solid.border}
                        strokeWidth={STROKE}
                        fill="none"
                    />
                    <Circle
                        cx={RING / 2}
                        cy={RING / 2}
                        r={radius}
                        stroke={theme.colors.brand[500]}
                        strokeWidth={STROKE}
                        strokeLinecap="round"
                        fill="none"
                        strokeDasharray={`${circumference} ${circumference}`}
                        strokeDashoffset={circumference * (1 - progress)}
                        transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
                    />
                </Svg>
                <SynMark size={64} />
            </Box>

            <VStack style={styles.list}>
                {GENERATION_STAGES.map((item, index) => {
                    const state = index < done ? 'done' : index === done ? 'active' : 'pending';

                    return (
                        <HStack key={item} style={styles.row}>
                            <Box style={styles.marker}>
                                {state === 'done' ? (
                                    <Icon
                                        name="check-circle"
                                        size={theme.space(6)}
                                        color={theme.colors.brand[500]}
                                    />
                                ) : state === 'active' ? (
                                    <Spinner />
                                ) : (
                                    <Box style={styles.pendingDot} />
                                )}
                            </Box>
                            <Text style={styles.label(state)}>
                                {t(`onboarding.generating.stages.${item}`)}
                            </Text>
                        </HStack>
                    );
                })}
            </VStack>

            <Box style={styles.spacer} />

            <VStack style={styles.actions}>
                <Text style={styles.note}>{t('onboarding.generating.note')}</Text>
                <Button
                    type="outline"
                    title={t('onboarding.generating.cancel')}
                    onPress={onCancel}
                />
            </VStack>
        </VStack>
    );
};
