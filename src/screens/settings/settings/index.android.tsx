import { FC, useEffect, useState } from 'react';
import { Alert, Platform, type View } from 'react-native';
import { router } from 'expo-router';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import Constants from 'expo-constants';
import * as MailComposer from 'expo-mail-composer';
import {
    ChevronRight,
    Bell,
    Lock,
    Volume2,
    Languages,
    Ruler,
    Megaphone,
    Mail,
    MessageCircle,
    Star,
    Undo2,
    UserRound,
    KeyRound,
    Droplet,
    Sparkles,
    LayoutDashboard,
    type LucideIcon,
} from 'lucide-react-native';

import { Title } from '@/components/typography/title';
import { ScrollView } from '@/components/primitives/scrollview';
import { VStack } from '@/components/primitives/vstack';
import { Box } from '@/components/primitives/box';
import { Pressable } from '@/components/primitives/pressable';
import { HStack } from '@/components/primitives/hstack';
import { Text } from '@/components/primitives/text';
import { isAuthConfigured } from '@/constants/auth';
import { useAccount } from '@/hooks/use-account';
import { useUser } from '@/hooks/use-user';
import { localeNames, normalizeLanguage } from '@/locale/constants';
import { useRunningWorkoutStatic } from '@/hooks/use-running-workout';
import { reportError } from '@/services/error-reporting';
import { requestStoreReviewIfAvailable } from '@/services/store-review';
import { useAnalytics } from '@/hooks/use-analytics';
import { JOIN_URL, SUPPORT_EMAIL } from '@/constants/contact';
import { InviteCard } from '@/components/brand/share-card';
import { shareCard } from '@/services/share';

/**
 * You, as the reference's Account page: who is signed in on a card of its
 * own, then grouped rows under small uppercase headings, each row a glyph in a
 * tinted square, its title, its value and a chevron.
 *
 * Theme, date and time, and heart-rate zones are no longer listed: the app is
 * dark only, and the other two run on their defaults. Their screens stay in
 * the project (`src/routes/settings/*`).
 */

type Row = {
    icon: LucideIcon;
    title: string;
    value?: string;
    /** The glyph square's colour; the brand red when unset. */
    tint?: string;
    onPress: () => void;
};

const styles = StyleSheet.create((theme) => ({
    container: {
        flex: 1,
        paddingHorizontal: theme.space(4),
    },
    content: {
        ...theme.screenContentPadding('root'),
        gap: theme.space(6),
    },
    profile: {
        alignItems: 'center',
        gap: theme.space(3),
        padding: theme.space(4),
        borderRadius: theme.radius['4xl'],
        borderCurve: 'continuous',
        backgroundColor: theme.colors.foreground,
    },
    avatar: {
        height: theme.space(14),
        width: theme.space(14),
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: theme.radius.full,
        backgroundColor: theme.colors.primarySoft,
    },
    profileText: {
        flex: 1,
        gap: theme.space(0.5),
    },
    profileName: {
        ...theme.fontSize.lg,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: theme.colors.typography,
    },
    profileEmail: {
        ...theme.fontSize.sm,
        color: theme.colors.mutedTypography,
    },
    section: {
        gap: theme.space(2),
    },
    sectionTitle: {
        ...theme.typography.eyebrow,
        textTransform: 'uppercase',
        color: theme.colors.mutedTypography,
        paddingHorizontal: theme.space(4),
    },
    group: {
        borderRadius: theme.radius['4xl'],
        borderCurve: 'continuous',
        backgroundColor: theme.colors.foreground,
        overflow: 'hidden',
    },
    row: {
        minHeight: 52,
        alignItems: 'center',
        gap: theme.space(3),
        paddingHorizontal: theme.space(4),
    },
    glyph: (tint: string) => ({
        height: theme.space(7.5),
        width: theme.space(7.5),
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: theme.radius.lg,
        backgroundColor: tint,
    }),
    rowTitle: {
        ...theme.fontSize.default,
        flex: 1,
        color: theme.colors.typography,
    },
    rowValue: {
        ...theme.fontSize.sm,
        maxWidth: '45%',
        color: theme.colors.mutedTypography,
    },
    divider: {
        height: StyleSheet.hairlineWidth,
        marginLeft: theme.space(14.5),
        backgroundColor: theme.colors.border,
    },
    version: {
        ...theme.fontSize.xs,
        textAlign: 'center',
        color: theme.colors.mutedTypography,
    },
}));

/** One heading and its rows, on a single card with hairlines between them. */
const Section: FC<{ title?: string; rows: Row[] }> = ({ title, rows }) => {
    const { theme } = useUnistyles();

    if (rows.length === 0) return null;

    return (
        <VStack style={styles.section}>
            {title ? (
                <Text style={styles.sectionTitle} accessibilityRole="header">
                    {title}
                </Text>
            ) : null}
            <VStack style={styles.group}>
                {rows.map((row, index) => (
                    <VStack key={row.title}>
                        {index > 0 ? <Box style={styles.divider} /> : null}
                        <Pressable
                            onPress={row.onPress}
                            accessibilityRole="button"
                            accessibilityLabel={
                                row.value ? `${row.title}, ${row.value}` : row.title
                            }
                        >
                            <HStack style={styles.row}>
                                <Box style={styles.glyph(row.tint ?? theme.colors.brand[500])}>
                                    <row.icon
                                        size={theme.space(4.5)}
                                        strokeWidth={2.25}
                                        color={theme.colors.white}
                                    />
                                </Box>
                                <Text style={styles.rowTitle} numberOfLines={1}>
                                    {row.title}
                                </Text>
                                {row.value ? (
                                    <Text style={styles.rowValue} numberOfLines={1}>
                                        {row.value}
                                    </Text>
                                ) : null}
                                <ChevronRight
                                    size={theme.space(4.5)}
                                    color={theme.colors.mutedTypography}
                                />
                            </HStack>
                        </Pressable>
                    </VStack>
                ))}
            </VStack>
        </VStack>
    );
};

const SettingsScreen = () => {
    const { user } = useUser();
    const { session } = useAccount();
    const { resetWatchSync } = useRunningWorkoutStatic();
    const { t } = useTranslation(['common', 'screens']);
    // State rather than a ref: the rows holding the share action are built during render.
    const [inviteCard, setInviteCard] = useState<View | null>(null);
    const { theme } = useUnistyles();
    const { track } = useAnalytics();

    const [isMailAvailable, setIsMailAvailable] = useState(false);

    useEffect(() => {
        MailComposer.isAvailableAsync()
            .then(setIsMailAvailable)
            .catch(() => {});
    }, []);

    const appVersion = Constants.expoConfig?.version;
    const buildVersion =
        Platform.OS === 'ios'
            ? Constants.expoConfig?.ios?.buildNumber
            : Constants.expoConfig?.android?.versionCode;

    const handleShare = () => {
        track('app:share_requested', { surface: 'settings' });
        shareCard(inviteCard, t('share.app.message', { ns: 'screens', url: JOIN_URL })).catch(
            (error) => {
                reportError(error, 'Failed to share FitSyn from settings:');
            },
        );
    };

    const handleManualReviewRequest = () => {
        requestStoreReviewIfAvailable()
            .then((attempt) => {
                track('app_review:manual_request', {
                    surface: 'settings',
                    storeReviewAvailable: attempt.isAvailable,
                    storeReviewHasAction: attempt.hasAction,
                });
            })
            .catch((error) => {
                reportError(error, 'Failed to request store review from settings:');
            });
    };

    const handleComposeEmail = (options: MailComposer.MailComposerOptions) => {
        MailComposer.composeAsync(options).catch(() => {});
    };

    const handleResetWatchSync = () => {
        Alert.alert(
            t('settings.items.resetWatchSync.confirmTitle', { ns: 'screens' }),
            t('settings.items.resetWatchSync.confirmDescription', { ns: 'screens' }),
            [
                {
                    text: t('cancel', { ns: 'common' }),
                    style: 'cancel',
                },
                {
                    text: t('reset', { ns: 'common' }),
                    style: 'destructive',
                    onPress: () => {
                        try {
                            resetWatchSync();
                            Alert.alert(
                                t('settings.items.resetWatchSync.successTitle', { ns: 'screens' }),
                                t('settings.items.resetWatchSync.successDescription', {
                                    ns: 'screens',
                                }),
                            );
                        } catch (error) {
                            reportError(error, 'Failed to reset watch sync state:');
                        }
                    },
                },
            ],
            {
                cancelable: true,
            },
        );
    };

    const name = user?.displayName?.trim() || t('settings.items.profile.title', { ns: 'screens' });

    const account: Row[] = isAuthConfigured()
        ? [
              {
                  icon: KeyRound,
                  title: t('settings.items.account.title', { ns: 'screens' }),
                  tint: theme.colors.neutral[600],
                  onPress: () => router.navigate('/settings/account'),
              },
          ]
        : [];

    const goals: Row[] = [
        {
            icon: Droplet,
            title: t('settings.items.water.title', { ns: 'screens' }),
            tint: theme.colors.hydration as string,
            onPress: () => router.navigate('/hydration' as never),
        },
        {
            icon: Sparkles,
            title: t('settings.items.planBuilds.title', { ns: 'screens' }),
            onPress: () => router.navigate('/quota' as never),
        },
        {
            icon: Ruler,
            title: t('settings.items.units.title', { ns: 'screens' }),
            value: [user?.weightUnits, user?.measurementUnits].filter(Boolean).join(', '),
            tint: theme.colors.neutral[600],
            onPress: () => router.navigate('/settings/units'),
        },
    ];

    const preferences: Row[] = [
        {
            icon: LayoutDashboard,
            title: t('settings.items.homeScreen.title', { ns: 'screens' }),
            tint: theme.colors.brand[600],
            onPress: () => router.navigate('/summary-edit' as never),
        },
        {
            icon: Bell,
            title: t('settings.items.notifications.title', { ns: 'screens' }),
            tint: theme.colors.brand[600],
            onPress: () => router.navigate('/settings/notifications'),
        },
        {
            icon: Lock,
            title: t('settings.items.autolock.title', { ns: 'screens' }),
            tint: theme.colors.neutral[600],
            onPress: () => router.navigate('/settings/autolock'),
        },
        {
            icon: Volume2,
            title: t('settings.items.sound.title', { ns: 'screens' }),
            tint: theme.colors.neutral[600],
            onPress: () => router.navigate('/settings/sound'),
        },
        {
            icon: Languages,
            title: t('settings.items.language.title', { ns: 'screens' }),
            value: localeNames[normalizeLanguage(user?.lng)],
            tint: theme.colors.neutral[600],
            onPress: () => router.navigate('/settings/language'),
        },
    ];

    const watch: Row[] =
        Platform.OS === 'ios'
            ? [
                  {
                      icon: Undo2,
                      title: t('settings.items.resetWatchSync.title', { ns: 'screens' }),
                      tint: theme.colors.neutral[600],
                      onPress: handleResetWatchSync,
                  },
              ]
            : [];

    const help: Row[] = [
        {
            // In-app, with its own mail fallback, so it is offered without a mail app too.
            icon: Mail,
            title: t('settings.help.items.sendFeedback.title', { ns: 'screens' }),
            tint: theme.colors.neutral[600],
            onPress: () => router.navigate('/settings/feedback' as never),
        },
        ...(isMailAvailable
            ? [
                  {
                      icon: Megaphone,
                      title: t('settings.help.items.reportProblem.title', { ns: 'screens' }),
                      tint: theme.colors.neutral[600],
                      onPress: () =>
                          handleComposeEmail({
                              subject: t('problem', { ns: 'common' }),
                              recipients: [SUPPORT_EMAIL],
                              body: `\n\n---\n${t('code', { ns: 'common' })}: ${user?.id}`,
                          }),
                  },
              ]
            : []),
    ];

    const supportFitup: Row[] = [
        {
            icon: MessageCircle,
            title: t('settings.supportFitup.items.tellFriend.title', { ns: 'screens' }),
            tint: theme.colors.neutral[600],
            onPress: handleShare,
        },
        {
            icon: Star,
            title: t('settings.supportFitup.items.reviewAppStore.title', { ns: 'screens' }),
            tint: theme.colors.amber[500],
            onPress: handleManualReviewRequest,
        },
    ];

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <Title type="h1" accessibilityRole="header">
                {t('settings.title', { ns: 'screens' })}
            </Title>

            <Pressable
                onPress={() => router.navigate('/settings/profile')}
                accessibilityRole="button"
                accessibilityLabel={name}
            >
                <HStack style={styles.profile}>
                    <Box style={styles.avatar}>
                        <UserRound size={theme.space(7)} color={theme.colors.primary} />
                    </Box>
                    <VStack style={styles.profileText}>
                        <Text style={styles.profileName} numberOfLines={1}>
                            {name}
                        </Text>
                        {session?.user.email ? (
                            <Text style={styles.profileEmail} numberOfLines={1}>
                                {session.user.email}
                            </Text>
                        ) : null}
                    </VStack>
                    <ChevronRight size={theme.space(4.5)} color={theme.colors.mutedTypography} />
                </HStack>
            </Pressable>

            <Section rows={account} />
            <Section title={t('settings.sections.goals', { ns: 'screens' })} rows={goals} />
            <Section
                title={t('settings.sections.preferences', { ns: 'screens' })}
                rows={preferences}
            />
            <Section title={t('settings.watch.title', { ns: 'screens' })} rows={watch} />
            <Section title={t('settings.help.title', { ns: 'screens' })} rows={help} />
            <Section
                title={t('settings.supportFitup.title', { ns: 'screens' })}
                rows={supportFitup}
            />

            <Text style={styles.version}>
                {`${t('settings.version', { ns: 'screens' })} ${appVersion} (${buildVersion})`}
            </Text>
            <InviteCard ref={setInviteCard} />
        </ScrollView>
    );
};

export default SettingsScreen;
