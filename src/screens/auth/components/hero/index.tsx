import { FC, ReactNode } from 'react';
import { Image } from 'expo-image';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Box } from '@/components/primitives/box';
import { VStack } from '@/components/primitives/vstack';
import { Text } from '@/components/primitives/text';
import { Title } from '@/components/typography/title';
import { Icon, type IconName } from '@/components/primitives/icon';

/**
 * The one visual moment every auth screen shares.
 *
 * Before this, sign-in, forgot-password, check-email and new-password each
 * opened on a bare `<Title>` and a line of muted text on the plain background
 * — identical markup copied four times, and identical in effect: nothing on
 * the first screen someone opens said what app this was. This is that markup
 * pulled into one place: the app's logo, or a tinted SF Symbol / Material
 * icon badge, over the title.
 *
 * Purely presentational: every screen still owns its own copy, its own icon,
 * and everything below the fold.
 */

// The app icon's own artwork, so the first screen and the home screen match.
const LOGO = require('../../../../../assets/images/logo.png');

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
    badge: {
        height: theme.space(16),
        width: theme.space(16),
        borderRadius: theme.radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.primarySoft,
    },
    /**
     * The logo is a full tile — dark square, coral F, white S — rather than the
     * mark cut out: a white S on its own would vanish on the light theme.
     */
    logo: {
        height: theme.space(20),
        width: theme.space(20),
        borderRadius: theme.radius['3xl'],
        borderCurve: 'continuous',
    },
    eyebrow: {
        ...theme.typography.eyebrow,
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
    /** Left out on sign-in, where the badge is the app's own logo instead. */
    icon?: IconName;
    /** Short, uppercase context tag above the title — e.g. "FitSyn". */
    eyebrow: string;
    title: string;
    subtitle?: string;
    children?: ReactNode;
}

export const AuthHero: FC<AuthHeroProps> = ({ icon, eyebrow, title, subtitle, children }) => {
    const { theme } = useUnistyles();

    return (
        <VStack style={styles.container}>
            <Box style={styles.glowLayer}>
                {icon ? (
                    <Box style={styles.badge}>
                        <Icon name={icon} size={theme.space(7)} color={theme.colors.primary} />
                    </Box>
                ) : (
                    <Image source={LOGO} style={styles.logo} accessibilityIgnoresInvertColors />
                )}
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
