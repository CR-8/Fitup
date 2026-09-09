import { useCallback, useEffect, useMemo, useRef } from 'react';
import { ActivityIndicator, Alert, FlatList, type ListRenderItem } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import {
    ChevronRight,
    Dumbbell,
    Salad,
    Sparkles,
    TrendingUp,
    Undo2,
    type LucideIcon,
} from 'lucide-react-native';

import { HStack } from '@/components/primitives/hstack';
import { VStack } from '@/components/primitives/vstack';
import { Text } from '@/components/primitives/text';
import { Pressable } from '@/components/primitives/pressable';
import { Title } from '@/components/typography/title';
import type { AiMessageSelect } from '@/db/schema';
import {
    useAiAvailable,
    useAiChat,
    useAiConversation,
    useAiMessages,
    useAiPlans,
    useAiQuota,
    useClearAiConversation,
} from '@/hooks/use-ai';

import { useUser } from '@/hooks/use-user';
import { Box } from '@/components/primitives/box';

import { Composer } from './components/composer';
import { Message } from './components/message';

const styles = StyleSheet.create((theme, rt) => ({
    container: {
        flex: 1,
        paddingHorizontal: theme.space(4),
    },
    header: {
        paddingTop: theme.screenHeaderHeight(),
        paddingBottom: theme.space(3),
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.space(3),
    },
    headerTitles: {
        flex: 1,
        gap: theme.space(0.5),
    },
    muted: {
        color: theme.colors.neutral[400],
    },
    list: {
        flex: 1,
    },
    listContent: {
        paddingBottom: theme.space(4),
        gap: theme.space(3),
    },
    listContentEmpty: {
        flexGrow: 1,
    },
    // Mirrors the rounded panel the settings and results screens use.
    panel: {
        backgroundColor: theme.colors.background,
        borderRadius: theme.radius['4xl'],
        padding: theme.space(5),
        gap: theme.space(2),
    },
    empty: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.space(2),
    },
    emptyText: {
        textAlign: 'center',
        color: theme.colors.neutral[400],
    },
    /**
     * What the screen shows before anyone has typed.
     *
     * It was a centred title and one line in the middle of an otherwise blank
     * screen, which reads as an unfinished feature rather than as a coach
     * waiting. The card says who is talking and the rows below say what can be
     * asked — and every one of them runs something that already exists.
     */
    intro: {
        gap: theme.space(3),
        paddingTop: theme.space(2),
    },
    introCard: {
        backgroundColor: theme.colors.foreground,
        borderRadius: theme.radius['3xl'],
        padding: theme.space(5),
        gap: theme.space(2),
    },
    introHeader: {
        alignItems: 'center',
        gap: theme.space(2.5),
    },
    introAvatar: {
        height: theme.space(10),
        width: theme.space(10),
        borderRadius: theme.radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.primarySoft,
    },
    introTitle: {
        ...theme.fontSize.lg,
        fontWeight: theme.fontWeight.bold.fontWeight,
        color: theme.colors.typography,
    },
    introBody: {
        ...theme.fontSize.sm,
        color: theme.colors.mutedTypography,
    },
    actionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space(3),
        paddingHorizontal: theme.space(4),
        paddingVertical: theme.space(3.5),
        borderRadius: theme.radius['2xl'],
        backgroundColor: theme.colors.foreground,
    },
    actionIcon: {
        height: theme.space(8),
        width: theme.space(8),
        borderRadius: theme.radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.background,
    },
    actionText: {
        flex: 1,
        gap: theme.space(0.5),
    },
    actionHint: {
        ...theme.fontSize.xs,
        color: theme.colors.mutedTypography,
    },
    actionLabel: {
        ...theme.fontSize.default,
        fontWeight: theme.fontWeight.medium.fontWeight,
        color: theme.colors.typography,
    },
    suggestions: {
        paddingBottom: theme.space(2),
        gap: theme.space(2),
    },
    suggestion: {
        paddingHorizontal: theme.space(4),
        paddingVertical: theme.space(2),
        borderRadius: theme.radius.full,
        backgroundColor: theme.colors.foreground,
    },
    suggestionDisabled: {
        opacity: 0.5,
    },
    resetButton: {
        height: theme.space(8),
        width: theme.space(8),
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.foreground,
        borderRadius: theme.radius.lg,
    },
}));

const SynScreen = () => {
    const { t } = useTranslation('screens');
    const { theme } = useUnistyles();
    const listRef = useRef<FlatList<AiMessageSelect>>(null);

    const { user } = useUser();
    const name = user?.displayName?.trim();

    const available = useAiAvailable();
    const { conversation, isLoading } = useAiConversation();
    const messages = useAiMessages(conversation?.id);
    const plans = useAiPlans(messages);
    const quota = useAiQuota();
    const { sendMessage, generatePlan, isBusy } = useAiChat(conversation?.id);
    const { mutateAsync: clearConversation } = useClearAiConversation();

    // Keep the newest turn in view as the conversation grows.
    useEffect(() => {
        if (messages.length === 0) return;
        const timeout = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
        return () => clearTimeout(timeout);
    }, [messages.length]);

    const quotaExhausted = quota.remaining <= 0;
    const conversationId = conversation?.id;

    const handleSend = useCallback(
        (value: string) => {
            // Failures are written into the conversation as an assistant turn, so
            // there is nothing further to surface here.
            sendMessage(value).catch(() => undefined);
        },
        [sendMessage],
    );

    const handleGenerate = useCallback(
        (kind: 'workout' | 'nutrition') => {
            if (quotaExhausted) {
                Alert.alert(t('syn.quota.title'), t('syn.quota.message', { limit: quota.limit }));
                return;
            }

            generatePlan({
                kind,
                intent:
                    kind === 'workout'
                        ? t('syn.actions.workoutIntent')
                        : t('syn.actions.nutritionIntent'),
            }).catch(() => undefined);
        },
        [generatePlan, quota.limit, quotaExhausted, t],
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
    const quickActions = useMemo<
        { key: string; icon: LucideIcon; label: string; hint: string; run: () => void }[]
    >(
        () => [
            {
                key: 'workout',
                icon: Dumbbell,
                label: t('syn.actions.workout'),
                hint: t('syn.actions.workoutHint'),
                run: () => handleGenerate('workout'),
            },
            {
                key: 'nutrition',
                icon: Salad,
                label: t('syn.actions.nutrition'),
                hint: t('syn.actions.nutritionHint'),
                run: () => handleGenerate('nutrition'),
            },
            {
                key: 'explain',
                icon: Sparkles,
                label: t('syn.actions.explain'),
                hint: t('syn.actions.explainHint'),
                run: () => handleSend(t('syn.actions.explainIntent')),
            },
            {
                key: 'progress',
                icon: TrendingUp,
                label: t('syn.actions.progress'),
                hint: t('syn.actions.progressHint'),
                run: () => handleSend(t('syn.actions.progressIntent')),
            },
        ],
        [handleGenerate, handleSend, t],
    );

    const listEmpty = useMemo(
        () => (
            <VStack style={styles.intro}>
                <VStack style={styles.introCard}>
                    <HStack style={styles.introHeader}>
                        <Box style={styles.introAvatar}>
                            <Sparkles
                                size={theme.space(5)}
                                strokeWidth={2}
                                color={theme.colors.primary}
                            />
                        </Box>
                        <Text style={styles.introTitle}>
                            {/* The name is optional — onboarding can be skipped —
                                so this has to read as a sentence without it. */}
                            {name
                                ? t('syn.intro.greeting', { name })
                                : t('syn.intro.greetingFallback')}
                        </Text>
                    </HStack>
                    <Text style={styles.introBody}>{t('syn.intro.body')}</Text>
                </VStack>

                {quickActions.map((action) => (
                    <Pressable
                        key={action.key}
                        style={[styles.actionRow, isBusy && styles.suggestionDisabled]}
                        onPress={action.run}
                        disabled={isBusy}
                        accessibilityRole="button"
                        accessibilityLabel={action.label}
                    >
                        <Box style={styles.actionIcon}>
                            <action.icon
                                size={theme.space(4)}
                                strokeWidth={2}
                                color={theme.colors.primary}
                            />
                        </Box>
                        <VStack style={styles.actionText}>
                            <Text style={styles.actionLabel}>{action.label}</Text>
                            <Text style={styles.actionHint} numberOfLines={2}>
                                {action.hint}
                            </Text>
                        </VStack>
                        <ChevronRight
                            size={theme.space(4.5)}
                            color={theme.colors.mutedTypography}
                        />
                    </Pressable>
                ))}
            </VStack>
        ),
        [isBusy, name, quickActions, t, theme],
    );

    // A build with no AI host configured shows why rather than failing on every turn.
    if (!available) {
        return (
            <VStack style={styles.container}>
                <HStack style={styles.header}>
                    <Title type="h1">{t('syn.title')}</Title>
                </HStack>
                <VStack style={styles.panel}>
                    <Title type="h6">{t('syn.unavailable.title')}</Title>
                    <Text fontSize="sm" style={styles.muted}>
                        {t('syn.unavailable.message')}
                    </Text>
                </VStack>
            </VStack>
        );
    }

    if (isLoading) {
        return (
            <VStack style={[styles.container, styles.empty]}>
                <ActivityIndicator color={theme.colors.brand[500]} />
            </VStack>
        );
    }

    return (
        <VStack style={styles.container}>
            <HStack style={styles.header}>
                <VStack style={styles.headerTitles}>
                    <Title type="h1">{t('syn.title')}</Title>
                    <Text fontSize="sm" style={styles.muted}>
                        {t('syn.subtitle')}
                    </Text>
                    <Text fontSize="xs" style={styles.muted}>
                        {t('syn.quota.remaining', {
                            remaining: quota.remaining,
                            limit: quota.limit,
                        })}
                    </Text>
                </VStack>

                {messages.length > 0 ? (
                    <Pressable
                        style={styles.resetButton}
                        onPress={handleClear}
                        accessibilityRole="button"
                        accessibilityLabel={t('syn.clear.title')}
                    >
                        <Undo2
                            size={theme.space(4)}
                            strokeWidth={theme.space(0.375)}
                            opacity={0.8}
                            color={theme.colors.typography}
                        />
                    </Pressable>
                ) : null}
            </HStack>

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
                keyboardDismissMode="interactive"
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            />

            {/* The intro above already offers both of these as full rows, so the
                pills would be the same two actions twice on an empty screen.
                They come back once there is a conversation to act on. */}
            {messages.length > 0 ? (
                <HStack style={styles.suggestions}>
                    <Pressable
                        style={[
                            styles.suggestion,
                            (isBusy || quotaExhausted) && styles.suggestionDisabled,
                        ]}
                        onPress={() => handleGenerate('workout')}
                        disabled={isBusy || quotaExhausted}
                    >
                        <Text fontSize="xs" fontWeight="medium">
                            {t('syn.actions.workout')}
                        </Text>
                    </Pressable>

                    <Pressable
                        style={[
                            styles.suggestion,
                            (isBusy || quotaExhausted) && styles.suggestionDisabled,
                        ]}
                        onPress={() => handleGenerate('nutrition')}
                        disabled={isBusy || quotaExhausted}
                    >
                        <Text fontSize="xs" fontWeight="medium">
                            {t('syn.actions.nutrition')}
                        </Text>
                    </Pressable>
                </HStack>
            ) : null}

            <Composer onSend={handleSend} busy={isBusy} />
        </VStack>
    );
};

export default SynScreen;
