import { Fragment, useCallback, useEffect, useMemo, useRef } from 'react';
import { ActivityIndicator, Alert, FlatList, ScrollView, type ListRenderItem } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';

import { HStack } from '@/components/primitives/hstack';
import { VStack } from '@/components/primitives/vstack';
import { Text } from '@/components/primitives/text';
import { Pressable } from '@/components/primitives/pressable';
import { Box } from '@/components/primitives/box';
import { Icon, type IconName } from '@/components/primitives/icon';
import { AuthHero } from '@/screens/auth/components/hero';
import type { AiMessageSelect } from '@/db/schema';
import {
    useAiAvailable,
    useAiMessages,
    useAiPlans,
    useClearAiConversation,
    useSynActions,
} from '@/hooks/use-ai';
import { useUser } from '@/hooks/use-user';

import { Composer } from './components/composer';
import { Pending } from './components/pending';
import { Message } from './components/message';
import { SynFrame, UnavailableFrame } from './components/frame';

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
    /**
     * What the screen shows before anyone has typed: the auth screens' hero —
     * who is talking — over one card of what can be asked. Every row runs
     * something that already exists.
     */
    intro: {
        gap: theme.space(6),
        paddingVertical: theme.space(4),
    },
    // Grouped like the sign-in panel: one card, rows divided by hairlines.
    actions: {
        backgroundColor: theme.colors.foreground,
        borderRadius: theme.radius['4xl'],
        borderCurve: 'continuous',
        paddingHorizontal: theme.space(4),
    },
    actionRow: {
        alignItems: 'center',
        gap: theme.space(3),
        paddingVertical: theme.space(3.5),
    },
    actionIcon: {
        height: theme.space(9),
        width: theme.space(9),
        borderRadius: theme.radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.primarySoft,
    },
    actionText: {
        flex: 1,
        gap: theme.space(0.5),
    },
    actionLabel: {
        ...theme.fontSize.default,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: theme.colors.typography,
    },
    actionHint: {
        ...theme.fontSize.xs,
        color: theme.colors.mutedTypography,
    },
    divider: {
        height: StyleSheet.hairlineWidth,
        marginLeft: theme.space(12),
        backgroundColor: theme.colors.border,
    },
    disabled: {
        opacity: 0.5,
    },
    // The monthly allowance, said where it is spent: under the hero, and at the
    // head of the suggestion row once a conversation is going.
    quota: (exhausted: boolean) => ({
        alignSelf: 'center',
        alignItems: 'center',
        gap: theme.space(1.5),
        paddingHorizontal: theme.space(3),
        paddingVertical: theme.space(1.5),
        borderRadius: theme.radius.full,
        backgroundColor: exhausted ? theme.colors.elevated : theme.colors.primarySoft,
    }),
    quotaText: (exhausted: boolean) => ({
        ...theme.fontSize.xs,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: exhausted ? theme.colors.mutedTypography : theme.colors.primary,
    }),
    suggestionsScroll: {
        flexGrow: 0,
    },
    suggestions: {
        alignItems: 'center',
        paddingBottom: theme.space(1),
        gap: theme.space(2),
    },
    suggestion: {
        paddingHorizontal: theme.space(4),
        paddingVertical: theme.space(2),
        borderRadius: theme.radius.full,
        backgroundColor: theme.colors.foreground,
    },
    panel: {
        backgroundColor: theme.colors.foreground,
        borderRadius: theme.radius['4xl'],
        borderCurve: 'continuous',
        padding: theme.space(5),
    },
}));

const QuotaChip = ({ remaining, limit }: { remaining: number; limit: number }) => {
    const { t } = useTranslation('screens');
    const { theme } = useUnistyles();
    const exhausted = remaining <= 0;

    return (
        <HStack style={styles.quota(exhausted)}>
            <Icon
                name="sparkles"
                size={theme.space(3.5)}
                color={exhausted ? theme.colors.mutedTypography : theme.colors.primary}
            />
            <Text style={styles.quotaText(exhausted)}>
                {t('syn.quota.remaining', { remaining, limit })}
            </Text>
        </HStack>
    );
};

const SynScreen = () => {
    const { t } = useTranslation('screens');
    const { theme } = useUnistyles();
    const listRef = useRef<FlatList<AiMessageSelect>>(null);

    const { user } = useUser();
    const name = user?.displayName?.trim();

    const available = useAiAvailable();
    // One hook, because Home can start a generation too and the thread has to
    // show it. See `useSynActions`.
    const { conversation, isLoading, generate, send, quota, exhausted, isGenerating, isBusy } =
        useSynActions();
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

    const handleGenerate = useCallback(
        (kind: 'workout' | 'nutrition') => {
            generate(
                kind,
                kind === 'workout'
                    ? t('syn.actions.workoutIntent')
                    : t('syn.actions.nutritionIntent'),
            );
        },
        [generate, t],
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
     * Four ways in, each bound to something the app can already do.
     *
     * The first two call `generatePlan`, which is what the suggestion pills
     * have always done. The second two send a prompt through the same
     * `sendMessage` the composer uses — so they are the user typing a good
     * question, not a scripted answer. Nothing here fakes a reply.
     */
    const quickActions = useMemo(() => {
        const actions: {
            key: string;
            icon: IconName;
            label: string;
            hint: string;
            run: () => void;
            spendsQuota: boolean;
        }[] = [
            {
                key: 'workout',
                icon: 'dumbbell',
                label: t('syn.actions.workout'),
                hint: t('syn.actions.workoutHint'),
                run: () => handleGenerate('workout'),
                spendsQuota: true,
            },
            {
                key: 'nutrition',
                icon: 'salad',
                label: t('syn.actions.nutrition'),
                hint: t('syn.actions.nutritionHint'),
                run: () => handleGenerate('nutrition'),
                spendsQuota: true,
            },
            {
                key: 'explain',
                icon: 'sparkles',
                label: t('syn.actions.explain'),
                hint: t('syn.actions.explainHint'),
                run: () => handleSend(t('syn.actions.explainIntent')),
                spendsQuota: false,
            },
            {
                key: 'progress',
                icon: 'trending-up',
                label: t('syn.actions.progress'),
                hint: t('syn.actions.progressHint'),
                run: () => handleSend(t('syn.actions.progressIntent')),
                spendsQuota: false,
            },
        ];

        return actions;
    }, [handleGenerate, handleSend, t]);

    const listEmpty = useMemo(
        () => (
            <VStack style={styles.intro}>
                <AuthHero
                    icon="sparkles"
                    eyebrow={t('syn.eyebrow')}
                    // The name is optional — onboarding can be skipped — so this
                    // has to read as a sentence without it.
                    title={
                        name ? t('syn.intro.greeting', { name }) : t('syn.intro.greetingFallback')
                    }
                    subtitle={t('syn.intro.body')}
                >
                    <QuotaChip remaining={quota.remaining} limit={quota.limit} />
                </AuthHero>

                <VStack style={styles.actions}>
                    {quickActions.map((action, index) => {
                        // Left enabled with no plans left: generating then says
                        // why, which a dead row would not.
                        const disabled = isBusy;

                        return (
                            <Fragment key={action.key}>
                                {index > 0 ? <Box style={styles.divider} /> : null}
                                <Pressable
                                    onPress={action.run}
                                    disabled={disabled}
                                    accessibilityRole="button"
                                    accessibilityLabel={action.label}
                                    accessibilityHint={action.hint}
                                    accessibilityState={{ disabled }}
                                >
                                    <HStack style={[styles.actionRow, disabled && styles.disabled]}>
                                        <Box style={styles.actionIcon}>
                                            <Icon
                                                name={action.icon}
                                                size={theme.space(4.5)}
                                                color={theme.colors.primary}
                                            />
                                        </Box>
                                        <VStack style={styles.actionText}>
                                            <Text style={styles.actionLabel}>{action.label}</Text>
                                            <Text style={styles.actionHint} numberOfLines={2}>
                                                {action.hint}
                                            </Text>
                                        </VStack>
                                        <Icon
                                            name="chevron-right"
                                            size={theme.space(4.5)}
                                            color={theme.colors.mutedTypography}
                                        />
                                    </HStack>
                                </Pressable>
                            </Fragment>
                        );
                    })}
                </VStack>
            </VStack>
        ),
        [isBusy, name, quickActions, quota.limit, quota.remaining, t, theme],
    );

    // A build with no AI host configured shows why rather than failing on every turn.
    if (!available) {
        return (
            <UnavailableFrame>
                <VStack style={styles.centered}>
                    <AuthHero
                        icon="sparkles"
                        eyebrow={t('syn.eyebrow')}
                        title={t('syn.unavailable.title')}
                        subtitle={t('syn.unavailable.message')}
                    />
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

            {/* The intro already offers all four as full rows, so the pills
                would repeat them on an empty screen. They come back once there
                is a conversation to act on — the only way back to them then.
                Scrolls rather than wraps, so it never pushes the composer up. */}
            {messages.length > 0 ? (
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={styles.suggestions}
                    style={styles.suggestionsScroll}
                >
                    <QuotaChip remaining={quota.remaining} limit={quota.limit} />
                    {quickActions.map((action) => {
                        // Only generating spends the monthly allowance; asking a
                        // question does not, so those two stay available.
                        const disabled = isBusy || (action.spendsQuota && exhausted);

                        return (
                            <Pressable
                                key={action.key}
                                style={[styles.suggestion, disabled && styles.disabled]}
                                onPress={action.run}
                                disabled={disabled}
                                accessibilityRole="button"
                            >
                                <Text fontSize="xs" fontWeight="medium">
                                    {action.label}
                                </Text>
                            </Pressable>
                        );
                    })}
                </ScrollView>
            ) : null}

            <Composer onSend={handleSend} busy={isBusy} />
        </SynFrame>
    );
};

export default SynScreen;
