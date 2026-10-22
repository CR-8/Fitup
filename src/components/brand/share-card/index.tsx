import { FC, ReactNode, Ref } from 'react';
import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';

import { Box } from '@/components/primitives/box';
import { HStack } from '@/components/primitives/hstack';
import { VStack } from '@/components/primitives/vstack';
import { Text } from '@/components/primitives/text';
import { SynMark } from '@/components/brand/syn-mark';
import { JOIN_URL } from '@/constants/contact';

/**
 * The picture that goes with a share: the achievement's art on the left, what
 * it is on the right, and FitSyn's mark with the join link along the foot.
 * Laid out at half Open Graph size (600 × 315) and captured at 1200 × 630 by
 * `shareCard` (services/share). It is drawn off screen, so it is never seen in
 * the app and screen readers skip it.
 */

const WIDTH = 600;
const HEIGHT = 315;

const styles = StyleSheet.create((theme) => ({
    host: {
        position: 'absolute',
        top: 0,
        left: -10_000,
    },
    card: {
        width: WIDTH,
        height: HEIGHT,
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space(7),
        paddingHorizontal: theme.space(8),
        paddingBottom: theme.space(6),
        overflow: 'hidden',
        backgroundColor: theme.colors.background,
    },
    glow: (accent: string, size: number) => ({
        position: 'absolute',
        top: HEIGHT / 2 - size / 2 - 12,
        left: 140 - size / 2,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: accent,
        opacity: 0.08,
    }),
    art: {
        width: 210,
        height: 210,
        alignItems: 'center',
        justifyContent: 'center',
    },
    text: {
        flex: 1,
        gap: theme.space(2),
    },
    eyebrow: (accent: string) => ({
        fontSize: 15,
        lineHeight: 20,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: accent,
    }),
    title: {
        fontSize: 34,
        lineHeight: 40,
        fontWeight: theme.fontWeight.bold.fontWeight,
        color: theme.colors.typography,
    },
    subtitle: {
        fontSize: 17,
        lineHeight: 24,
        color: theme.colors.mutedTypography,
    },
    footer: {
        position: 'absolute',
        left: theme.space(8),
        right: theme.space(8),
        bottom: theme.space(5),
        alignItems: 'center',
        gap: theme.space(2),
        paddingTop: theme.space(3),
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: theme.colors.neutral[600],
    },
    brand: {
        fontSize: 18,
        lineHeight: 24,
        fontWeight: theme.fontWeight.bold.fontWeight,
        color: theme.colors.typography,
    },
    join: {
        flex: 1,
        textAlign: 'right',
        fontSize: 15,
        lineHeight: 20,
        color: theme.colors.mutedTypography,
    },
}));

interface ShareCardProps {
    ref?: Ref<View>;
    /** The achievement's own colour: the glow behind its art and the eyebrow. */
    accent: string;
    eyebrow: string;
    title: string;
    subtitle?: string;
    art: ReactNode;
}

export const ShareCard: FC<ShareCardProps> = ({ ref, accent, eyebrow, title, subtitle, art }) => {
    const { t } = useTranslation(['screens']);
    const { theme } = useUnistyles();

    return (
        <View
            style={styles.host}
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
        >
            <View ref={ref} collapsable={false} style={styles.card}>
                <LinearGradient
                    colors={theme.gradients.surface}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                />
                <Box style={styles.glow(accent, 300)} />
                <Box style={styles.glow(accent, 200)} />
                <Box style={styles.art}>{art}</Box>
                <VStack style={styles.text}>
                    <Text style={styles.eyebrow(accent)} numberOfLines={1}>
                        {eyebrow}
                    </Text>
                    <Text style={styles.title} numberOfLines={2}>
                        {title}
                    </Text>
                    {subtitle ? (
                        <Text style={styles.subtitle} numberOfLines={2}>
                            {subtitle}
                        </Text>
                    ) : null}
                </VStack>
                <HStack style={styles.footer}>
                    <SynMark size={26} />
                    <Text style={styles.brand}>FitSyn</Text>
                    <Text style={styles.join} numberOfLines={1}>
                        {t('share.join', {
                            ns: 'screens',
                            url: JOIN_URL.replace(/^https?:\/\//, ''),
                        })}
                    </Text>
                </HStack>
            </View>
        </View>
    );
};

/** The invite, for Tell a Friend: FitSyn's mark and what it does. */
export const InviteCard: FC<{ ref?: Ref<View> }> = ({ ref }) => {
    const { t } = useTranslation(['screens']);
    const { theme } = useUnistyles();

    return (
        <ShareCard
            ref={ref}
            accent={theme.colors.brand[500]}
            eyebrow={t('share.app.eyebrow', { ns: 'screens' })}
            title={t('share.app.title', { ns: 'screens' })}
            subtitle={t('share.app.subtitle', { ns: 'screens' })}
            art={<SynMark size={190} />}
        />
    );
};
