import { FC } from 'react';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';

import { Box } from '@/components/primitives/box';
import { HStack } from '@/components/primitives/hstack';
import { Text } from '@/components/primitives/text';
import { VStack } from '@/components/primitives/vstack';
import { Pressable } from '@/components/primitives/pressable';

// Sized so the ring and both round buttons fit a 360pt-wide phone.
const SIZE = 200;
const STROKE = 18;

const styles = StyleSheet.create((theme) => ({
    container: {
        alignItems: 'center',
    },
    row: {
        alignSelf: 'stretch',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    ring: {
        height: SIZE,
        width: SIZE,
        alignItems: 'center',
        justifyContent: 'center',
    },
    svg: {
        position: 'absolute',
    },
    value: {
        fontSize: 64,
        lineHeight: 72,
        color: theme.colors.typography,
        ...theme.typography.metric,
    },
    paused: {
        opacity: 0.55,
    },
    label: {
        ...theme.fontSize.sm,
        color: theme.colors.mutedTypography,
    },
    // Round, either side of the ring, as the reference player's skip controls.
    adjust: {
        height: 56,
        width: 56,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: theme.radius.full,
        backgroundColor: theme.colors.elevated,
    },
    adjustDisabled: {
        opacity: 0.4,
    },
    adjustText: {
        fontSize: 18,
        lineHeight: 22,
        color: theme.colors.typography,
        ...theme.typography.metric,
    },
}));

type RestRingProps = {
    /** "1:30". */
    value: string;
    /** How much of the rest has passed, 0 to 1. */
    elapsedFraction: number;
    paused: boolean;
    disabled: boolean;
    onAdjust: (deltaSeconds: number) => void;
};

/**
 * Rest as the reference's countdown: what is left in big condensed numerals
 * inside a thick ring that drains as it passes, with round −15 s and +15 s
 * controls either side. Skipping rest is the screen's primary button, below.
 * A countdown, not an activity ring: it measures one rest and nothing else.
 */
export const RestRing: FC<RestRingProps> = ({
    value,
    elapsedFraction,
    paused,
    disabled,
    onAdjust,
}) => {
    const { t } = useTranslation('screens');
    const { theme } = useUnistyles();

    const radius = (SIZE - STROKE) / 2;
    const circumference = 2 * Math.PI * radius;
    const remaining = 1 - Math.min(1, Math.max(0, elapsedFraction));

    const adjustButton = (delta: number, label: string, a11y: string) => (
        <Pressable
            style={[styles.adjust, disabled && styles.adjustDisabled]}
            onPress={() => onAdjust(delta)}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={a11y}
            accessibilityState={{ disabled }}
        >
            <Text style={styles.adjustText}>{label}</Text>
        </Pressable>
    );

    return (
        <VStack style={styles.container}>
            <HStack style={styles.row}>
                {adjustButton(-15, '−15', t('timer.a11y.restLess'))}

                <Box style={styles.ring}>
                    <Svg width={SIZE} height={SIZE} style={styles.svg}>
                        <Defs>
                            <LinearGradient id="rest" x1="0" y1="0" x2="1" y2="1">
                                <Stop offset="0" stopColor={theme.solid.primary} />
                                <Stop offset="1" stopColor={theme.colors.brand[300]} />
                            </LinearGradient>
                        </Defs>
                        <Circle
                            cx={SIZE / 2}
                            cy={SIZE / 2}
                            r={radius}
                            stroke={theme.solid.elevated}
                            strokeWidth={STROKE}
                            fill="none"
                        />
                        <Circle
                            cx={SIZE / 2}
                            cy={SIZE / 2}
                            r={radius}
                            stroke="url(#rest)"
                            strokeWidth={STROKE}
                            strokeLinecap="round"
                            fill="none"
                            strokeDasharray={`${circumference} ${circumference}`}
                            strokeDashoffset={circumference * (1 - remaining)}
                            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
                        />
                    </Svg>
                    <Text
                        style={[styles.value, paused && styles.paused]}
                        accessibilityLiveRegion="polite"
                        accessibilityLabel={`${t('timer.restRemaining')} ${value}`}
                    >
                        {value}
                    </Text>
                    <Text style={styles.label}>{t('timer.restRemaining')}</Text>
                </Box>

                {adjustButton(15, '+15', t('timer.a11y.restMore'))}
            </HStack>
        </VStack>
    );
};
