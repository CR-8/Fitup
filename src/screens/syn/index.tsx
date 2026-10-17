import { useCallback, useEffect, useMemo, useRef } from 'react';
import { ActivityIndicator, Alert, FlatList, ScrollView, type ListRenderItem } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';

import { HStack } from '@/components/primitives/hstack';
import { VStack } from '@/components/primitives/vstack';
import { Text } from '@/components/primitives/text';
import { Pressable } from '@/components/primitives/pressable';
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
import { CoachHub } from './components/hub';
import { hasSeenSynWelcome } from '@/screens/syn-welcome';

const styles = StyleSheet.create((theme) => ({
    container: {
        flex: 1,
        paddingHorizontal: theme.space(4),
    },
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
    // An empty thread centres its welcome in whatever height is left, so it
    // sits balanced above the composer instead of hugging the top.
    listContentEmpty: {
        flexGrow: 1,
        justifyContent: 'center',
    },
    chips: {
        flexWrap: 'wrap',
        gap: theme.space(2),
    },
    // Outlined, never filled: the screen's one filled button is the proposal's.
    chip: {
        minHeight: 40,
        justifyContent: 'center',
        paddingHorizontal: theme.space(4),
        borderRadius: theme.radius.full,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    chipText: {
        ...theme.fontSize.sm,
        fontWeight: theme.fontWeight.medium.fontWeight,
        color: theme.colors.typography,
    },
    disabled: {
        opacity: 0.5,
    },
    quota: {
        ...theme.fontSize.xs,
        textAlign: 'center',
        color: theme.colors.mutedTypography,
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
     * Four ways in, each bound to something the app can already do. The first
     * two open the plan-build form; the other two send a prompt through the same
     * `sendMessage` the composer uses, so they are the user typing a good
     * question. Nothing here fakes a reply.
     */
    const starters = useMemo<Starter[]>(
        () => [
            {
                key: 'week',
                label: t('syn.starters.week'),
                run: () => openForm('workout'),
                spendsQuota: true,
            },
            {
                key: 'food',
                label: t('syn.starters.food'),
                run: () => openForm('nutrition'),
                spendsQuota: true,
            },
            {
                key: 'form',
                label: t('syn.starters.form'),
                run: () => handleSend(t('syn.starters.formIntent')),
                spendsQuota: false,
            },
            {
                key: 'progress',
                label: t('syn.starters.progress'),
                run: () => handleSend(t('syn.actions.progressIntent')),
                spendsQuota: false,
            },
        ],
        [handleSend, openForm, t],
    );

    // "N plan builds left · resets 1 Nov": the month count is computed from the
    // plans on this device, so the reset is the first of next month.
    const quotaLine = t('syn.quota.builds', {
        count: quota.remaining,
        date: dayjs().add(1, 'month').startOf('month').format('D MMM'),
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
                <Text style={styles.chipText}>{starter.label}</Text>
            </Pressable>
        );
    };

    const chips = [
        ...starters.map(chip),
        chip({
            key: 'plans',
            label: t('coach.plans.title'),
            run: () => router.navigate('/coach/plans' as never),
            spendsQuota: false,
        }),
    ];

    // The hub offers the two builds as large choices, so only the free
    // questions are chips there.
    const listEmpty = (
        <CoachHub
            freeChips={
                <HStack style={styles.chips}>
                    {starters.filter((starter) => !starter.spendsQuota).map(chip)}
                </HStack>
            }
        />
    );

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
            <VStack style={[styles.container, styles.centered]}>
                <ActivityIndicator color={theme.colors.primary} />
            </VStack>
        );
    }

    return (
        <SynFrame canClear={messages.length > 0} onClear={handleClear}>
            <FlatList
                ref={listRef}
                style={styles.list}
                contentContainerStyle={[
                    styles.listContent,
                    messages.length === 0 && styles.listContentEmpty,
                ]}
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

            {/* The empty state already offers all four, so the row would repeat
                them. It comes back once there is a conversation to act on.
                Scrolls rather than wraps, so it never pushes the composer up. */}
            {messages.length > 0 ? (
                <VStack style={styles.threadFooter}>
                    <Pressable
                        onPress={() => router.navigate('/quota' as never)}
                        accessibilityRole="button"
                    >
                        <Text style={styles.quota}>{quotaLine}</Text>
                    </Pressable>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                        contentContainerStyle={styles.suggestions}
                        style={styles.suggestionsScroll}
                    >
                        {chips}
                    </ScrollView>
                </VStack>
            ) : null}

            <Composer onSend={handleSend} busy={isBusy} />
        </SynFrame>
    );
};

export default SynScreen;
