import { useCallback, useEffect, useMemo, useRef } from 'react';
import { ActivityIndicator, Alert, FlatList, type ListRenderItem } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { Undo2 } from 'lucide-react-native';

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

const TonyScreen = () => {
    const { t } = useTranslation('screens');
    const { theme } = useUnistyles();
    const listRef = useRef<FlatList<AiMessageSelect>>(null);

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
                Alert.alert(t('tony.quota.title'), t('tony.quota.message', { limit: quota.limit }));
                return;
            }

            generatePlan({
                kind,
                intent:
                    kind === 'workout'
                        ? t('tony.actions.workoutIntent')
                        : t('tony.actions.nutritionIntent'),
            }).catch(() => undefined);
        },
        [generatePlan, quota.limit, quotaExhausted, t],
    );

    const handleClear = useCallback(() => {
        if (!conversationId) return;

        Alert.alert(t('tony.clear.title'), t('tony.clear.message'), [
            { text: t('tony.plan.cancel'), style: 'cancel' },
            {
                text: t('tony.clear.confirm'),
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

    const listEmpty = useMemo(
        () => (
            <VStack style={styles.empty}>
                <Title type="h5">{t('tony.empty.title')}</Title>
                <Text fontSize="sm" style={styles.emptyText}>
                    {t('tony.empty.message')}
                </Text>
            </VStack>
        ),
        [t],
    );

    // A build with no AI host configured shows why rather than failing on every turn.
    if (!available) {
        return (
            <VStack style={styles.container}>
                <HStack style={styles.header}>
                    <Title type="h1">{t('tony.title')}</Title>
                </HStack>
                <VStack style={styles.panel}>
                    <Title type="h6">{t('tony.unavailable.title')}</Title>
                    <Text fontSize="sm" style={styles.muted}>
                        {t('tony.unavailable.message')}
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
                    <Title type="h1">{t('tony.title')}</Title>
                    <Text fontSize="xs" style={styles.muted}>
                        {t('tony.quota.remaining', {
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
                        accessibilityLabel={t('tony.clear.title')}
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
                        {t('tony.actions.workout')}
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
                        {t('tony.actions.nutrition')}
                    </Text>
                </Pressable>
            </HStack>

            <Composer onSend={handleSend} busy={isBusy} />
        </VStack>
    );
};

export default TonyScreen;
