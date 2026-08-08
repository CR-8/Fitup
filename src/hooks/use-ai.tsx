import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { requestCompletion } from '@/api/ai';
import { AI_CONFIG, isAiEnabled, type AiPlanKind } from '@/constants/ai';
import { buildChatMessages, buildPlanMessages } from '@/ai/prompt';
import { extractJsonObject, validatePlanPayload } from '@/ai/validate';
import { applyPlanToSchedule, revertAppliedPlan } from '@/ai/apply-plan';
import {
    buildChatHistory,
    buildRequestContext,
    countPlansThisMonth,
    createConversation,
    createMessage,
    createPlan,
    deleteConversation,
    getLatestConversation,
    getMessages,
    getPlansByIds,
    getProfile,
    markPlanDiscarded,
    upsertProfile,
} from '@/crud/ai';
import type { AiMessageSelect, AiPlanSelect, AiProfileSelect } from '@/db/schema';
import { AiError } from '@/types/ai';
import { reportError } from '@/services/error-reporting';

import { useUser } from './use-user';
import { useAnalytics } from './use-analytics';

/** Horizon retried when a plan at the requested length runs out of output budget. */
const FALLBACK_HORIZON_DAYS = 3;

const CONVERSATION_KEY = 'ai-conversation';
const MESSAGES_KEY = 'ai-messages';
const PLANS_KEY = 'ai-plans';
const PROFILE_KEY = 'ai-profile';
const QUOTA_KEY = 'ai-quota';

export const useAiAvailable = (): boolean => useMemo(() => isAiEnabled(), []);

export const useAiConversation = () => {
    const { user } = useUser();

    const { data, isLoading } = useQuery({
        queryKey: [CONVERSATION_KEY, user?.id],
        queryFn: async () => {
            const existing = await getLatestConversation(user!.id);
            return existing ?? (await createConversation(user!.id));
        },
        enabled: !!user?.id,
        staleTime: Infinity,
    });

    return { conversation: data ?? null, isLoading };
};

export const useAiMessages = (conversationId: string | undefined) => {
    const { data = [] } = useQuery({
        queryKey: [MESSAGES_KEY, conversationId],
        queryFn: () => getMessages(conversationId!),
        enabled: !!conversationId,
        placeholderData: [],
    });

    return data as AiMessageSelect[];
};

/** Plans referenced by the visible messages, so cards render inline. */
export const useAiPlans = (messages: AiMessageSelect[]) => {
    const planIds = useMemo(
        () =>
            Array.from(
                new Set(
                    messages
                        .map((message) => message.planId)
                        .filter((id): id is string => typeof id === 'string'),
                ),
            ),
        [messages],
    );

    const { data = [] } = useQuery({
        queryKey: [PLANS_KEY, planIds],
        queryFn: () => getPlansByIds(planIds),
        enabled: planIds.length > 0,
        placeholderData: [],
    });

    return useMemo(
        () =>
            (data as AiPlanSelect[]).reduce<Record<string, AiPlanSelect>>((acc, plan) => {
                acc[plan.id] = plan;
                return acc;
            }, {}),
        [data],
    );
};

export const useAiProfile = () => {
    const { user } = useUser();
    const queryClient = useQueryClient();

    const { data } = useQuery({
        queryKey: [PROFILE_KEY, user?.id],
        queryFn: () => getProfile(user!.id),
        enabled: !!user?.id,
    });

    const { mutateAsync: save, isPending } = useMutation({
        mutationFn: (updates: Partial<AiProfileSelect>) => upsertProfile(user!.id, updates),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [PROFILE_KEY, user?.id] });
        },
    });

    return { profile: (data ?? null) as AiProfileSelect | null, save, isSaving: isPending };
};

export const useAiQuota = () => {
    const { user } = useUser();

    const { data = 0 } = useQuery({
        queryKey: [QUOTA_KEY, user?.id],
        queryFn: () => countPlansThisMonth(user!.id),
        enabled: !!user?.id,
        staleTime: 30_000,
    });

    return {
        used: data,
        limit: AI_CONFIG.monthlyQuota,
        remaining: Math.max(0, AI_CONFIG.monthlyQuota - data),
    };
};

const resolveErrorKey = (error: unknown): string => {
    if (error instanceof AiError) {
        switch (error.code) {
            case 'DISABLED':
                return 'tony.errors.disabled';
            case 'NO_INTERNET':
                return 'tony.errors.offline';
            case 'TIMEOUT':
                return 'tony.errors.timeout';
            case 'RATE_LIMIT':
                return 'tony.errors.rateLimit';
            case 'QUOTA':
                return 'tony.errors.quota';
            case 'AUTH':
                return 'tony.errors.auth';
            case 'INVALID_RESPONSE':
                return 'tony.errors.invalid';
            case 'TRUNCATED':
                return 'tony.errors.truncated';
            default:
                return 'tony.errors.provider';
        }
    }

    return 'tony.errors.provider';
};

export const useAiChat = (conversationId: string | undefined) => {
    const { user } = useUser();
    const { t, i18n } = useTranslation('screens');
    const queryClient = useQueryClient();
    const { track } = useAnalytics();

    const invalidate = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: [MESSAGES_KEY, conversationId] });
        queryClient.invalidateQueries({ queryKey: [PLANS_KEY] });
        queryClient.invalidateQueries({ queryKey: [QUOTA_KEY, user?.id] });
    }, [conversationId, queryClient, user?.id]);

    const { mutateAsync: sendMessage, isPending: isSending } = useMutation({
        mutationFn: async (prompt: string) => {
            if (!conversationId || !user?.id) return;

            await createMessage({ conversationId, role: 'user', content: prompt });
            invalidate();

            const context = await buildRequestContext(
                user.id,
                i18n.language,
                user.weightUnits ?? 'kg',
            );
            const history = buildChatHistory(await getMessages(conversationId));

            // Drop the turn just written, since it is passed separately as the prompt.
            const priorHistory = history.slice(0, -1);

            try {
                const result = await requestCompletion({
                    messages: buildChatMessages(context, priorHistory, prompt),
                });

                await createMessage({
                    conversationId,
                    role: 'assistant',
                    content: result.content.trim(),
                });

                track('ai:chat_message', { model: result.model });
            } catch (error) {
                await createMessage({
                    conversationId,
                    role: 'assistant',
                    content: t(resolveErrorKey(error)),
                    errorCode: error instanceof AiError ? error.code : 'UNKNOWN',
                });
                throw error;
            }
        },
        onSettled: invalidate,
        onError: (error) => reportError(error, 'AI chat turn failed'),
    });

    const { mutateAsync: generatePlan, isPending: isGenerating } = useMutation({
        mutationFn: async ({
            kind,
            intent,
            horizonDays = 7,
        }: {
            kind: AiPlanKind;
            intent: string;
            horizonDays?: number;
        }) => {
            if (!conversationId || !user?.id) return;

            await createMessage({ conversationId, role: 'user', content: intent });
            invalidate();

            const context = await buildRequestContext(
                user.id,
                i18n.language,
                user.weightUnits ?? 'kg',
            );

            /**
             * One attempt at the requested horizon, then a shorter one if the reply
             * ran out of room. A truncated plan cannot be salvaged — the JSON is cut
             * mid-structure — but the same request over fewer days usually fits, and a
             * shorter plan beats no plan.
             */
            const attempt = async (days: number) => {
                const result = await requestCompletion({
                    messages: buildPlanMessages(context, kind, intent, days),
                    json: true,
                });

                return {
                    result,
                    ...validatePlanPayload(
                        extractJsonObject(result.content),
                        kind,
                        context.candidates,
                    ),
                };
            };

            try {
                const isTruncation = (error: unknown) =>
                    error instanceof AiError && error.code === 'TRUNCATED';

                const { result, payload, repairs } = await attempt(horizonDays).catch(
                    async (error) => {
                        if (!isTruncation(error) || horizonDays <= FALLBACK_HORIZON_DAYS) {
                            throw error;
                        }

                        return await attempt(FALLBACK_HORIZON_DAYS);
                    },
                );

                const plan = await createPlan({
                    userId: user.id,
                    conversationId,
                    kind,
                    intent,
                    payload,
                    modelId: result.model,
                });

                await createMessage({
                    conversationId,
                    role: 'assistant',
                    content: payload.summary ?? payload.title,
                    planId: plan.id,
                });

                track('ai:plan_generated', {
                    kind,
                    model: result.model,
                    repairs: repairs.length,
                });

                return plan;
            } catch (error) {
                await createMessage({
                    conversationId,
                    role: 'assistant',
                    content: t(resolveErrorKey(error)),
                    errorCode: error instanceof AiError ? error.code : 'UNKNOWN',
                });
                throw error;
            }
        },
        onSettled: invalidate,
        onError: (error) => reportError(error, 'AI plan generation failed'),
    });

    return {
        sendMessage,
        generatePlan,
        isSending,
        isGenerating,
        isBusy: isSending || isGenerating,
    };
};

export const useApplyAiPlan = () => {
    const { user } = useUser();
    const queryClient = useQueryClient();
    const { track } = useAnalytics();

    const { mutateAsync: apply, isPending: isApplying } = useMutation({
        mutationFn: async (plan: AiPlanSelect) => {
            if (!user?.id) return null;

            const result = await applyPlanToSchedule(plan.id, plan.payload, user.id);
            track('ai:plan_applied', { kind: plan.kind, workouts: result.workoutIds.length });

            return result;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [PLANS_KEY] });
            queryClient.invalidateQueries({ queryKey: ['workouts'] });
        },
    });

    const { mutateAsync: revert, isPending: isReverting } = useMutation({
        mutationFn: async (plan: AiPlanSelect) => {
            await revertAppliedPlan(plan.appliedWorkoutIds ?? []);
            await markPlanDiscarded(plan.id);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [PLANS_KEY] });
            queryClient.invalidateQueries({ queryKey: ['workouts'] });
        },
    });

    return { apply, revert, isApplying, isReverting };
};

export const useClearAiConversation = () => {
    const { user } = useUser();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (conversationId: string) => {
            await deleteConversation(conversationId);
            await createConversation(user!.id);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [CONVERSATION_KEY, user?.id] });
            queryClient.invalidateQueries({ queryKey: [MESSAGES_KEY] });
            queryClient.invalidateQueries({ queryKey: [PLANS_KEY] });
        },
    });
};
