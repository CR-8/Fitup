import { FC, useCallback } from 'react';
import { router } from 'expo-router';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';

import { Box } from '@/components/primitives/box';
import { Text } from '@/components/primitives/text';
import { VStack } from '@/components/primitives/vstack';
import { Pressable } from '@/components/primitives/pressable';
import { SynMark } from '@/components/brand/syn-mark';
import { Button } from '@/components/buttons/base';
import { markWelcomeSeen } from '@/helpers/welcome';

/**
 * The first screen a new install sees, once: a photograph, a promise, and the
 * way in. `HERO_PHOTO` is a placeholder until the team supplies licensed
 * imagery; swap the file, not the code.
 */
const HERO_PHOTO = require('../../../assets/images/placeholders/hero-gym.jpg');

const styles = StyleSheet.create((theme, rt) => ({
    container: {
        flex: 1,
        backgroundColor: theme.colors.neutral[950],
    },
    photo: {
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
    },
    scrim: {
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
    },
    content: {
        flex: 1,
        justifyContent: 'flex-end',
        paddingHorizontal: theme.space(6),
        paddingBottom: rt.insets.bottom + theme.space(6),
        gap: theme.space(8),
    },
    copy: {
        gap: theme.space(3),
    },
    // Always white: it sits on a photograph under a dark scrim, in either theme.
    title: {
        fontSize: 44,
        lineHeight: 48,
        fontWeight: theme.fontWeight.bold.fontWeight,
        color: theme.colors.white,
    },
    subtitle: {
        ...theme.fontSize.default,
        color: theme.colors.neutral[300],
        maxWidth: '88%',
    },
    actions: {
        gap: theme.space(3),
    },
    link: {
        minHeight: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    linkText: {
        ...theme.fontSize.default,
        color: theme.colors.neutral[300],
        textAlign: 'center',
    },
    linkAction: {
        color: theme.colors.brand[400],
        fontWeight: theme.fontWeight.semibold.fontWeight,
    },
}));

const WelcomeScreen: FC = () => {
    const { t } = useTranslation('screens');

    const getStarted = useCallback(() => {
        markWelcomeSeen();
        router.replace('/sign-in?mode=register');
    }, []);

    const signIn = useCallback(() => {
        markWelcomeSeen();
        router.replace('/sign-in');
    }, []);

    return (
        <Box style={styles.container}>
            <Image
                source={HERO_PHOTO}
                style={styles.photo}
                contentFit="cover"
                accessibilityIgnoresInvertColors
            />
            <LinearGradient
                colors={['rgba(8, 9, 11, 0.15)', 'rgba(8, 9, 11, 1)']}
                locations={[0.25, 0.8]}
                style={styles.scrim}
            />

            <VStack style={styles.content}>
                <VStack style={styles.copy}>
                    {/* A01: the brand mark over the promise. */}
                    <SynMark size={44} />
                    <Text style={styles.title} accessibilityRole="header">
                        {t('welcome.title')}
                    </Text>
                    <Text style={styles.subtitle}>{t('welcome.subtitle')}</Text>
                </VStack>

                <VStack style={styles.actions}>
                    <Button type="primary" title={t('welcome.getStarted')} onPress={getStarted} />
                    <Pressable style={styles.link} onPress={signIn} accessibilityRole="button">
                        <Text style={styles.linkText}>
                            {t('welcome.haveAccount')}{' '}
                            <Text style={[styles.linkText, styles.linkAction]}>
                                {t('welcome.signIn')}
                            </Text>
                        </Text>
                    </Pressable>
                </VStack>
            </VStack>
        </Box>
    );
};

export default WelcomeScreen;
