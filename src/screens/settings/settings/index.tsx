import { useEffect, useState } from 'react';
import { Alert, Platform, type View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Constants from 'expo-constants';
import * as MailComposer from 'expo-mail-composer';
import { FieldGroup, Text as UIText } from '@expo/ui';

import { Host } from '@/components/native/host';
import { SettingsRow } from '@/components/native/settings-row';
import type { IconName } from '@/components/primitives/icon';
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

type Row = {
    icon: IconName;
    title: string;
    value?: string;
    supportingText?: string;
    onPress: () => void;
};

const SettingsScreen = () => {
    const { user } = useUser();
    const { session } = useAccount();
    const { resetWatchSync } = useRunningWorkoutStatic();
    const { t } = useTranslation(['common', 'screens']);
    // State rather than a ref: the rows holding the share action are built during render.
    const [inviteCard, setInviteCard] = useState<View | null>(null);
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

    const settings: Row[] = [
        {
            icon: 'person-circle',
            // The profile row doubles as the screen's header: who is signed in.
            title:
                user?.displayName?.trim() || t('settings.items.profile.title', { ns: 'screens' }),
            supportingText: session?.user.email ?? undefined,
            onPress: () => router.navigate('/settings/profile'),
        },
        // Hidden entirely in a build shipped without accounts, where the row
        // would lead to a screen that can only say "unavailable".
        ...(isAuthConfigured()
            ? ([
                  {
                      icon: 'key',
                      title: t('settings.items.account.title', { ns: 'screens' }),
                      onPress: () => router.navigate('/settings/account'),
                  },
              ] satisfies Row[])
            : []),
    ];

    // Grouped as the reference's Account page. Theme, date and time, and
    // heart-rate zones are no longer listed (dark only; the other two run on
    // their defaults); their screens stay in `src/routes/settings`.
    const goals: Row[] = [
        {
            icon: 'droplet',
            title: t('settings.items.water.title', { ns: 'screens' }),
            onPress: () => router.navigate('/hydration' as never),
        },
        {
            icon: 'sparkles',
            title: t('settings.items.planBuilds.title', { ns: 'screens' }),
            onPress: () => router.navigate('/quota' as never),
        },
        {
            icon: 'ruler',
            title: t('settings.items.units.title', { ns: 'screens' }),
            value: [user?.weightUnits, user?.measurementUnits].filter(Boolean).join(', '),
            onPress: () => router.navigate('/settings/units'),
        },
    ];

    const preferences: Row[] = [
        {
            icon: 'home',
            title: t('settings.items.homeScreen.title', { ns: 'screens' }),
            onPress: () => router.navigate('/summary-edit' as never),
        },
        {
            icon: 'bell',
            title: t('settings.items.notifications.title', { ns: 'screens' }),
            onPress: () => router.navigate('/settings/notifications'),
        },
        {
            icon: 'lock',
            title: t('settings.items.autolock.title', { ns: 'screens' }),
            onPress: () => router.navigate('/settings/autolock'),
        },
        {
            icon: 'volume-high',
            title: t('settings.items.sound.title', { ns: 'screens' }),
            onPress: () => router.navigate('/settings/sound'),
        },
        {
            icon: 'language',
            title: t('settings.items.language.title', { ns: 'screens' }),
            value: localeNames[normalizeLanguage(user?.lng)],
            onPress: () => router.navigate('/settings/language'),
        },
    ];

    const watch: Row[] = [
        {
            icon: 'undo',
            title: t('settings.items.resetWatchSync.title', { ns: 'screens' }),
            onPress: handleResetWatchSync,
        },
    ];

    const help: Row[] = [
        {
            icon: 'megaphone',
            title: t('settings.help.items.reportProblem.title', { ns: 'screens' }),
            onPress: () =>
                handleComposeEmail({
                    subject: t('problem', { ns: 'common' }),
                    recipients: [SUPPORT_EMAIL],
                    body: `\n\n---\n${t('code', { ns: 'common' })}: ${user?.id}`,
                }),
        },
    ];

    // In-app: it has its own mail fallback, so it is offered even where the mail
    // composer is not available.
    const feedback: Row[] = [
        {
            icon: 'mail',
            title: t('settings.help.items.sendFeedback.title', { ns: 'screens' }),
            onPress: () => router.navigate('/settings/feedback' as never),
        },
    ];

    const supportFitup: Row[] = [
        {
            icon: 'message',
            title: t('settings.supportFitup.items.tellFriend.title', { ns: 'screens' }),
            onPress: handleShare,
        },
        {
            icon: 'star',
            title: t('settings.supportFitup.items.reviewAppStore.title', { ns: 'screens' }),
            onPress: handleManualReviewRequest,
        },
    ];

    const section = (rows: Row[], disclosure: boolean) =>
        rows.map((row) => (
            <SettingsRow
                key={row.title}
                icon={row.icon}
                title={row.title}
                value={row.value}
                supportingText={row.supportingText}
                disclosure={disclosure}
                onPress={row.onPress}
            />
        ));

    return (
        <>
            <InviteCard ref={setInviteCard} />
            <Host style={{ flex: 1 }}>
                <FieldGroup>
                    <FieldGroup.Section>{section(settings, true)}</FieldGroup.Section>
                    <FieldGroup.Section title={t('settings.sections.goals', { ns: 'screens' })}>
                        {section(goals, true)}
                    </FieldGroup.Section>
                    <FieldGroup.Section
                        title={t('settings.sections.preferences', { ns: 'screens' })}
                    >
                        {section(preferences, true)}
                    </FieldGroup.Section>
                    {Platform.OS === 'ios' && (
                        <FieldGroup.Section title={t('settings.watch.title', { ns: 'screens' })}>
                            {section(watch, false)}
                        </FieldGroup.Section>
                    )}
                    <FieldGroup.Section title={t('settings.help.title', { ns: 'screens' })}>
                        {section(feedback, true)}
                        {isMailAvailable ? section(help, false) : null}
                    </FieldGroup.Section>
                    <FieldGroup.Section title={t('settings.supportFitup.title', { ns: 'screens' })}>
                        {section(supportFitup, false)}
                        <FieldGroup.SectionFooter>
                            <UIText>
                                {`${t('settings.version', { ns: 'screens' })} ${appVersion} (${buildVersion})`}
                            </UIText>
                        </FieldGroup.SectionFooter>
                    </FieldGroup.Section>
                </FieldGroup>
            </Host>
        </>
    );
};

export default SettingsScreen;
