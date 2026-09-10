import { FC, ReactNode } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import type { LucideIcon } from 'lucide-react-native';

import { Box } from '@/components/primitives/box';
import { VStack } from '@/components/primitives/vstack';
import { Text } from '@/components/primitives/text';
import { Title } from '@/components/typography/title';

/**
 * The one visual moment every auth screen shares.
 *
 * Before this, sign-in, forgot-password, check-email and new-password each
 * opened on a bare `<Title>` and a line of muted text on the plain background
 * — identical markup copied four times, and identical in effect: nothing on
 * the first screen someone opens said what app this was. This is that markup
 * pulled into one place and given the app's own coral-on-glow language — the
 * `primarySoft` icon badge from onboarding, the `gradients.glow` token that
 * the theme itself already calls "the design's radial bloom" and nothing had
 * used it for yet.
 *
 * Purely presentational: every screen still owns its own copy, its own icon,
 * and everything below the fold.
 */

const GLOW_SIZE = 220;

const styles = StyleSheet.create((theme) => ({
    container: {
        alignItems: 'center',
        gap: theme.space(4),
        paddingTop: theme.space(2),
    },
    glowLayer: {
        height: theme.space(20),
        alignItems: 'center',
        justifyContent: 'center',
    },
    glow: {
        position: 'absolute',
        width: GLOW_SIZE,
        height: GLOW_SIZE,
        borderRadius: GLOW_SIZE / 2,
    },
    badge: {
        height: theme.space(16),
        width: theme.space(16),
        borderRadius: theme.radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.primarySoft,
    },
    eyebrow: {
        ...theme.fontSize['2xs'],
        letterSpacing: 1.6,
        textTransform: 'uppercase',
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: theme.colors.mutedTypography,
    },
    copy: {
        alignItems: 'center',
        gap: theme.space(2),
    },
    title: {
        textAlign: 'center',
    },
    subtitle: {
        textAlign: 'center',
        color: theme.colors.mutedTypography,
        maxWidth: '86%',
    },
}));

interface AuthHeroProps {
    icon: LucideIcon;
    /** Short, uppercase context tag above the title — e.g. "FitSync". */
    eyebrow: string;
    title: string;
    subtitle?: string;
    children?: ReactNode;
}

export const AuthHero: FC<AuthHeroProps> = ({ icon: Icon, eyebrow, title, subtitle, children }) => {
    const { theme } = useUnistyles();

    return (
        <VStack style={styles.container}>
            <Box style={styles.glowLayer}>
                {/* Centered under the badge rather than behind it exactly, so it
                    reads as ambient light the badge sits in front of, not a
                    halo traced around its edge. */}
                <LinearGradient
                    colors={theme.gradients.glow as [string, string]}
                    start={{ x: 0.5, y: 0.5 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.glow}
                />
                <Box style={styles.badge}>
                    <Icon size={theme.space(7)} strokeWidth={2.2} color={theme.colors.primary} />
                </Box>
            </Box>

            <VStack style={styles.copy}>
                <Text style={styles.eyebrow}>{eyebrow}</Text>
                <Title type="h1" style={styles.title}>
                    {title}
                </Title>
                {subtitle ? (
                    <Text fontSize="sm" style={styles.subtitle}>
                        {subtitle}
                    </Text>
                ) : null}
            </VStack>

            {children}
        </VStack>
    );
};
