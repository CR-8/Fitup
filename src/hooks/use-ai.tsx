import { useCallback, useMemo } from 'react';
import { Alert } from 'react-native';
import { useIsMutating, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { requestCompletion } from '@/api/ai';
import { AI_CONFIG, isAiEnabled, type AiPlanKind } from '@/constants/ai';
import { buildChatMessages, buildPlanMessages } from '@/ai/prompt';
import { extractJsonObject, parseAssessment } from '@/ai/validate';
import { applyPlanToSchedule, revertAppliedPlan } from '@/ai/apply-plan';
import {
    buildChatHistory,
    buildRequestContext,
    countPlansThisMonth,
    createConversation,
    createMessage,
    createPlan,
    deleteConversation,
    getActivePlan,
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

/**
 * How many `need_info` turns this conversation gets before `generatePlan`
 * forces a plan out under conservative assumptions instead of asking again —
 * see `ASSESSMENT_SCHEMA_HINT` in src/ai/prompt.ts and the `FORCE_READY` line
 * it looks for. A cautious plan the user did not fully brief beats a fourth
 * question they may never answer.
 */
const INTAKE_QUESTION_LIMIT = 2;

/** How far back to look when counting prior intake turns. Generous on purpose: a
 *  short window could undercount across a conversation with other chat in between
 *  and let the cap reset by accident. */
const INTAKE_LOOKBACK_MESSAGES = 20;

const CONVERSATION_KEY = 'ai-conversation';
const MESSAGES_KEY = 'ai-messages';
const PLANS_KEY = 'ai-plans';
const PROFILE_KEY = 'ai-profile';
const QUOTA_KEY = 'ai-quota';
const ACTIVE_PLAN_KEY = 'ai-active-plan';

/**
 * Keyed so that *any* component can ask whether Syn is working, not just the one
 * that started it.
 *
 * `useMutation` state is local to the hook call that created it, and three
 * components mount `useSynActions` — the two cards on Home and the Syn thread.
 * Without a shared key, tapping generate on Home left the thread's own mutation
 * idle, so the user was navigated to a motionless screen and the plan arrived
 * with no warning: the exact gap the pending row exists to close.
 */
const SEND_MUTATION_KEY = ['ai-send'] as const;
const GENERATE_MUTATION_KEY = ['ai-generate'] as const;

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

/**
 * The plan the user is training on, or null.
 *
 * Just the row. Progress is worked out by `derivePlanProgress` from the workout
 * rows the caller already has, so finishing a session moves the card through
 * the existing workouts query rather than needing this one re-read.
 */
export const useActivePlan = () => {
    const { user } = useUser();

    const { data, isLoading } = useQuery({
        queryKey: [ACTIVE_PLAN_KEY, user?.id],
        queryFn: () => getActivePlan(user!.id),
        enabled: !!user?.id,
    });

    return { activePlan: (data ?? null) as AiPlanSelect | null, isLoading };
};

const resolveErrorKey = (error: unknown): string => {
    if (error instanceof AiError) {
        switch (error.code) {
            case 'DISABLED':
                return 'syn.errors.disabled';
            case 'NO_INTERNET':
                return 'syn.errors.offline';
            case 'TIMEOUT':
                return 'syn.errors.timeout';
            case 'RATE_LIMIT':
                return 'syn.errors.rateLimit';
            case 'QUOTA':
                return 'syn.errors.quota';
            case 'AUTH':
                return 'syn.errors.auth';
            case 'INVALID_RESPONSE':
                return 'syn.errors.invalid';
            case 'TRUNCATED':
                return 'syn.errors.truncated';
            default:
                return 'syn.errors.provider';
        }
    }

    return 'syn.errors.provider';
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

    const { mutateAsync: sendMessage } = useMutation({
        mutationKey: SEND_MUTATION_KEY,
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

    const { mutateAsync: generatePlan } = useMutation({
        mutationKey: GENERATE_MUTATION_KEY,
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

            // Retrieval needs something to embed — `intent` is it. Passed as
            // buildRequestContext's fourth argument, which is what actually
            // triggers a retrieval call; omitted (as `sendMessage` above
            // does), the context comes back exactly as it always has.
            const context = await buildRequestContext(
                user.id,
                i18n.language,
                user.weightUnits ?? 'kg',
                intent,
            );

            // The turn just written is passed separately as `intent`, and the
            // prior turns are what let the model see a question it already
            // asked and the user's reply to it — see `priorHistory` in
            // `buildPlanMessages`. Also what `forceReady` below counts over.
            const recentMessages = (await getMessages(conversationId)).slice(
                -INTAKE_LOOKBACK_MESSAGES,
            );
            const priorHistory = buildChatHistory(recentMessages.slice(0, -1));
            const priorIntakeTurns = recentMessages.filter((message) => message.isIntake).length;
            const forceReady = priorIntakeTurns >= INTAKE_QUESTION_LIMIT;

            /**
             * One attempt at the requested horizon, then a shorter one if the reply
             * ran out of room. A truncated plan cannot be salvaged — the JSON is cut
             * mid-structure — but the same request over fewer days usually fits, and a
             * shorter plan beats no plan.
             */
            const attempt = async (days: number) => {
                const result = await requestCompletion({
                    messages: buildPlanMessages(
                        context,
                        kind,
                        intent,
                        days,
                        priorHistory,
                        forceReady,
                    ),
                    json: true,
                });

                return {
                    result,
                    assessment: parseAssessment(
                        extractJsonObject(result.content),
                        kind,
                        context.candidates,
                    ),
                };
            };

            try {
                const isTruncation = (error: unknown) =>
                    error instanceof AiError && error.code === 'TRUNCATED';

                const { result, assessment } = await attempt(horizonDays).catch(async (error) => {
                    if (!isTruncation(error) || horizonDays <= FALLBACK_HORIZON_DAYS) {
                        throw error;
                    }

                    return await attempt(FALLBACK_HORIZON_DAYS);
                });

                if (assessment.status === 'need_info') {
                    await createMessage({
                        conversationId,
                        role: 'assistant',
                        content: assessment.questions.join('\n'),
                        isIntake: true,
                    });

                    track('ai:intake_question', { kind, model: result.model });

                    return undefined;
                }

                if (assessment.status === 'stop') {
                    await createMessage({
                        conversationId,
                        role: 'assistant',
                        content: assessment.message,
                    });

                    track('ai:intake_stop', { kind, model: result.model });

                    return undefined;
                }

                const { payload, repairs } = assessment;

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

    // Counted across every mounted caller, so Home and the thread agree.
    const isSending = useIsMutating({ mutationKey: SEND_MUTATION_KEY }) > 0;
    const isGenerating = useIsMutating({ mutationKey: GENERATE_MUTATION_KEY }) > 0;

    return {
        sendMessage,
        generatePlan,
        isSending,
        isGenerating,
        isBusy: isSending || isGenerating,
    };
};

/**
 * Everything a screen needs to put Syn to work: the one entry point.
 *
 * Home and the Syn thread both offer to generate, and the quota guard is the
 * part that must not be written twice: refusing before spending is all that
 * stands between a stray tap and a wasted month's allowance, and two copies is
 * how one of them ends up checking the wrong side of zero.
 *
 * Callers supply the intent — the wording differs between a chip on Home and a
 * pill in the thread — and `generate` reports whether the request actually
 * started, so a caller can avoid claiming it did.
 *
 * Failures are deliberately swallowed here. `useAiChat` writes them into the
 * conversation as an assistant turn, which outlives an alert that interrupts
 * and then disappears.
 */
export const useSynActions = () => {
    const { t } = useTranslation('screens');
    const { conversation, isLoading } = useAiConversation();
    const quota = useAiQuota();

    // Safe to mount in several places at once: the pending flags come from
    // `useIsMutating` over a shared key, not from this instance's own mutation,
    // so a generation begun on Home is visible to the Syn thread too.
    const { sendMessage, generatePlan, isSending, isGenerating, isBusy } = useAiChat(
        conversation?.id,
    );

    const exhausted = quota.remaining <= 0;

    const generate = useCallback(
        (kind: AiPlanKind, intent: string, horizonDays?: number): boolean => {
            if (exhausted) {
                Alert.alert(t('syn.quota.title'), t('syn.quota.message', { limit: quota.limit }));
                return false;
            }

            generatePlan({ kind, intent, horizonDays }).catch(() => undefined);

            return true;
        },
        [exhausted, generatePlan, quota.limit, t],
    );

    const send = useCallback(
        (prompt: string) => {
            sendMessage(prompt).catch(() => undefined);
        },
        [sendMessage],
    );

    return {
        conversation,
        isLoading,
        generate,
        send,
        quota,
        exhausted,
        isSending,
        isGenerating,
        isBusy,
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
            // Applying is what makes a plan the active one, which is what Home's
            // plan card reads.
            queryClient.invalidateQueries({ queryKey: [ACTIVE_PLAN_KEY, user?.id] });
        },
    });

    const { mutateAsync: revert, isPending: isReverting } = useMutation({
        mutationFn: async (plan: AiPlanSelect) => {
            await revertAppliedPlan(plan.appliedWorkoutIds ?? [], plan.id);
            await markPlanDiscarded(plan.id);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [PLANS_KEY] });
            queryClient.invalidateQueries({ queryKey: ['workouts'] });
            queryClient.invalidateQueries({ queryKey: [ACTIVE_PLAN_KEY, user?.id] });
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
