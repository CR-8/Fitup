import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Alert, FlatList, ScrollView, type ListRenderItem } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';

import { VStack } from '@/components/primitives/vstack';
import { Text } from '@/components/primitives/text';
import { Pressable } from '@/components/primitives/pressable';
import { Icon, type IconName } from '@/components/primitives/icon';
import { AuthHero } from '@/screens/auth/components/hero';
import { Button } from '@/components/buttons/base';
import { AI_CONFIG } from '@/constants/ai';
import { useAccount } from '@/hooks/use-account';
import { router, useFocusEffect } from 'expo-router';
import type { AiMessageSelect } from '@/db/schema';
import {
    useAiAvailable,
    useAiMessages,
    useAiPlans,
    useClearAiConversation,
    useSynActions,
} from '@/hooks/use-ai';

import { Composer } from './components/composer';
import { Pending } from './components/pending';
import { Message } from './components/message';
import { SynFrame, UnavailableFrame } from './components/frame';
import { CoachHub, CoachHubSkeleton, type Question } from './components/hub';
import { hasSeenSynWelcome } from '@/screens/syn-welcome';

const styles = StyleSheet.create((theme) => ({
    centered: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    list: {
        flex: 1,
    },
    listContent: {
        paddingTop: theme.space(2),
        paddingBottom: theme.space(4),
        gap: theme.space(3),
    },
    // Filled pills with their own glyph, as Today's controls: the screen's one
    // bright fill stays the send button and the proposal's.
    chip: {
        minHeight: 40,
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space(2),
        paddingHorizontal: theme.space(3.5),
        borderRadius: theme.radius.full,
        backgroundColor: theme.colors.foreground,
    },
    chipText: {
        ...theme.fontSize.sm,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: theme.colors.typography,
    },
    disabled: {
        opacity: 0.5,
    },
    quota: {
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space(1.5),
        paddingHorizontal: theme.space(3),
        paddingVertical: theme.space(1),
        borderRadius: theme.radius.full,
        backgroundColor: theme.colors.primarySoft,
    },
    quotaText: {
        ...theme.fontSize.xs,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: theme.colors.primary,
    },
    threadFooter: {
        gap: theme.space(2),
    },
    suggestionsScroll: {
        flexGrow: 0,
    },
    suggestions: {
        alignItems: 'center',
        paddingBottom: theme.space(1),
        gap: theme.space(2),
    },
}));

type Starter = {
    key: string;
    label: string;
    icon: IconName;
    run: () => void;
    spendsQuota: boolean;
};

const SynScreen = () => {
    const { t } = useTranslation('screens');
    const { theme } = useUnistyles();
    const listRef = useRef<FlatList<AiMessageSelect>>(null);

    const available = useAiAvailable();
    const { isSignedIn } = useAccount();
    // One hook, because Home can start a generation too and the thread has to
    // show it. See `useSynActions`.
    const { conversation, isLoading, send, quota, isGenerating, isBusy } = useSynActions();
    const messages = useAiMessages(conversation?.id);
    const plans = useAiPlans(messages);
    const { mutateAsync: clearConversation } = useClearAiConversation();

    // Keep the newest turn in view as the conversation grows — including the
    // pending row, which is the only sign of life during a generation and is
    // worthless below the fold.
    useEffect(() => {
        if (messages.length === 0 && !isBusy) return;
        const timeout = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
        return () => clearTimeout(timeout);
    }, [messages.length, isBusy]);

    const conversationId = conversation?.id;

    const handleSend = send;

    // Building a plan always goes through the form, which shows what it is
    // based on and what it costs before anything is spent.
    const openForm = useCallback((kind: 'workout' | 'nutrition') => {
        router.navigate(
            (kind === 'workout'
                ? '/coach/build'
                : { pathname: '/coach/new', params: { kind } }) as never,
        );
    }, []);

    // Syn's AI caution comes before its first use on this device.
    useFocusEffect(
        useCallback(() => {
            if (!hasSeenSynWelcome()) router.navigate('/syn-welcome' as never);
        }, []),
    );

    const handleClear = useCallback(() => {
        if (!conversationId) return;

        Alert.alert(t('syn.clear.title'), t('syn.clear.message'), [
            { text: t('syn.plan.cancel'), style: 'cancel' },
            {
                text: t('syn.clear.confirm'),
                style: 'destructive',
                onPress: () => {
                    clearConversation(conversationId).catch(() => undefined);
                },
            },
        ]);
    }, [clearConversation, conversationId, t]);

    const renderItem = useCallback<ListRenderItem<AiMessageSelect>>(
        ({ item }) => (
            <Message message={item} plan={item.planId ? plans[item.planId] : undefined} />
        ),
        [plans],
    );

    /**
     * The ways in, each bound to something the app can already do. The builds
     * open the plan-build form; the questions send a prompt through the same
     * `sendMessage` the composer uses, so they are the user typing a good
     * question. Nothing here fakes a reply.
     */
    const starters = useMemo<Starter[]>(
        () => [
            {
                key: 'week',
                label: t('syn.starters.week'),
                icon: 'dumbbell',
                run: () => openForm('workout'),
                spendsQuota: true,
            },
            {
                key: 'food',
                label: t('syn.starters.food'),
                icon: 'utensils',
                run: () => openForm('nutrition'),
                spendsQuota: true,
            },
            {
                key: 'form',
                label: t('syn.starters.form'),
                icon: 'target',
                run: () => handleSend(t('syn.starters.formIntent')),
                spendsQuota: false,
            },
            {
                key: 'progress',
                label: t('syn.starters.progress'),
                icon: 'trending-up',
                run: () => handleSend(t('syn.actions.progressIntent')),
                spendsQuota: false,
            },
            {
                key: 'explain',
                label: t('syn.actions.explain'),
                icon: 'message',
                run: () => handleSend(t('syn.actions.explainIntent')),
                spendsQuota: false,
            },
        ],
        [handleSend, openForm, t],
    );

    // "N plan builds left · resets 1 Nov", from the server's count when it has one.
    const quotaLine = t('syn.quota.builds', {
        count: quota.remaining,
        date: dayjs(quota.resetsOn).format('D MMM'),
    });

    const chip = (starter: Starter) => {
        // A used-up month still opens the form, which says so and links to the
        // allowance; a disabled chip would not say why.
        const disabled = isBusy;

        return (
            <Pressable
                key={starter.key}
                style={[styles.chip, disabled && styles.disabled]}
                onPress={starter.run}
                disabled={disabled}
                accessibilityRole="button"
                accessibilityState={{ disabled }}
            >
                <Icon
                    name={starter.icon}
                    size={14}
                    color={starter.spendsQuota ? theme.colors.primary : theme.colors.typography}
                />
                <Text style={styles.chipText}>{starter.label}</Text>
            </Pressable>
        );
    };

    // The hub offers the builds as large choices, so only the free questions
    // are listed there.
    const questions: Question[] = starters
        .filter((starter) => !starter.spendsQuota)
        .map(({ key, label, icon, run }) => ({
            key,
            label,
            icon,
            run: isBusy ? () => undefined : run,
        }));
    const listEmpty = <CoachHub questions={questions} />;

    // A build with no AI host configured shows why rather than failing on every turn.
    if (!available) {
        return (
            <UnavailableFrame>
                <VStack style={styles.centered}>
                    <AuthHero
                        icon="syn"
                        eyebrow={t('syn.eyebrow')}
                        title={t('syn.unavailable.title')}
                        subtitle={t('syn.unavailable.message')}
                    />
                </VStack>
            </UnavailableFrame>
        );
    }

    // Through the proxy, Syn is for signed-in people only: say so rather than
    // letting every turn fail.
    if (AI_CONFIG.transport === 'proxy' && !isSignedIn) {
        return (
            <UnavailableFrame>
                <VStack style={styles.centered}>
                    <AuthHero
                        icon="syn"
                        eyebrow={t('syn.eyebrow')}
                        title={t('syn.signInRequired.title')}
                        subtitle={t('syn.signInRequired.message')}
                    >
                        <Button
                            type="primary"
                            title={t('syn.signInRequired.action')}
                            onPress={() => router.navigate('/sign-in')}
                        />
                    </AuthHero>
                </VStack>
            </UnavailableFrame>
        );
    }

    if (isLoading) {
        return (
            <UnavailableFrame>
                <CoachHubSkeleton />
            </UnavailableFrame>
        );
    }

    return (
        <SynFrame canClear={messages.length > 0} onClear={handleClear}>
            <FlatList
                ref={listRef}
                style={styles.list}
                contentContainerStyle={styles.listContent}
                data={messages}
                renderItem={renderItem}
                keyExtractor={(item) => item.id}
                ListEmptyComponent={listEmpty}
                ListFooterComponent={
                    isBusy ? <Pending kind={isGenerating ? 'plan' : 'reply'} /> : null
                }
                keyboardDismissMode="interactive"
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            />

            {/* The empty state already offers every one, so the row would repeat
                them. It comes back once there is a conversation to act on.
                Scrolls rather than wraps, so it never pushes the composer up. */}
            {messages.length > 0 ? (
                <VStack style={styles.threadFooter}>
                    <Pressable
                        style={styles.quota}
                        onPress={() => router.navigate('/quota' as never)}
                        accessibilityRole="button"
                    >
                        <Icon name="sparkles" size={12} color={theme.colors.primary} />
                        <Text style={styles.quotaText}>{quotaLine}</Text>
                    </Pressable>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                        contentContainerStyle={styles.suggestions}
                        style={styles.suggestionsScroll}
                    >
                        {starters.map(chip)}
                    </ScrollView>
                </VStack>
            ) : null}

            <Composer onSend={handleSend} busy={isBusy} />
        </SynFrame>
    );
};

export default SynScreen;
