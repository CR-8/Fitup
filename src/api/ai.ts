import {
    AxiosHeaders,
    create as createAxios,
    isAxiosError,
    type AxiosResponse,
    type RawAxiosHeaders,
} from 'axios';
import { create } from 'zustand';

import {
    AI_CONFIG,
    buildCompletionsUrl,
    buildSamplingParameters,
    isAiEnabled,
} from '@/constants/ai';
import { reportError } from '@/services/error-reporting';
import { supabase } from '@/services/supabase';
import { AiError, type AiFailureCode } from '@/types/ai';

export interface AiChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface AiCompletionOptions {
    messages: AiChatMessage[];
    /** Ask the provider for a JSON object rather than prose. */
    json?: boolean;
    signal?: AbortSignal;
}

export interface AiCompletionResult {
    content: string;
    model: string | null;
    promptTokens: number | null;
    completionTokens: number | null;
}

interface ChatCompletionResponse {
    model?: string;
    choices?: { message?: { content?: string }; finish_reason?: string }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
    error?: { message?: string; type?: string };
}

// Statuses expected to recover on a later attempt, matching the sync client's policy.
const RETRYABLE_HTTP_STATUSES = new Set([408, 429, 502, 503, 504]);
const TIMEOUT_ERROR_CODES = new Set(['ECONNABORTED', 'ETIMEDOUT']);
const NETWORK_ERROR_CODES = new Set(['ERR_NETWORK', 'ERR_CANCELED']);

// Transient or user-caused conditions are not actionable in Sentry.
const SUPPRESS_SENTRY_CODES = new Set<AiFailureCode>([
    'SIGN_IN',
    'USER_QUOTA',
    'NO_INTERNET',
    'TIMEOUT',
    'RATE_LIMIT',
    'QUOTA',
    'DISABLED',
]);

/**
 * Transient and user-caused failures already reach the user as a turn in the
 * thread; reporting them as faults only buries the real ones.
 */
export const isReportableAiError = (error: unknown): boolean =>
    !(error instanceof AiError && SUPPRESS_SENTRY_CODES.has(error.code));

/** What the proxy last said about an account's plan builds. */
export interface AiUsage {
    /** The Supabase account the count belongs to. */
    userId: string;
    remaining: number;
    /** `YYYY-MM-DD`, the first day of the next UTC month. */
    resetsOn: string;
}

/**
 * The server's count, taken from the `X-Syn-Builds-*` headers `syn-complete`
 * puts on every answer, errors included (supabase/migrations/0012). Set here,
 * where every request passes, so no caller has to remember to. Null until the
 * first request of the session, and always in direct mode, which has no server
 * count.
 */
export const useAiUsageStore = create<{ usage: AiUsage | null }>()(() => ({ usage: null }));

const recordUsage = (headers: AxiosResponse['headers'] | undefined, userId: string | null) => {
    if (!headers || !userId) return;

    // Case-insensitive, whatever case the platform's networking hands back.
    const read = AxiosHeaders.from(headers as RawAxiosHeaders);
    const remaining = Number(read.get('x-syn-builds-remaining'));
    const resetsOn = String(read.get('x-syn-builds-reset'));

    if (!Number.isInteger(remaining) || remaining < 0 || !/^\d{4}-\d{2}-\d{2}$/.test(resetsOn)) {
        return;
    }

    useAiUsageStore.setState({ usage: { userId, remaining, resetsOn } });
};

const aiClient = createAxios({ timeout: AI_CONFIG.timeoutMs });

/** The request headers, and the account they speak for (proxy mode only). */
const buildHeaders = async (): Promise<{
    headers: Record<string, string>;
    userId: string | null;
}> => {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...AI_CONFIG.headers,
    };

    // In proxy mode the backend attaches the provider credential; the device never
    // holds one, and proves who is asking with the signed-in session instead.
    // In direct mode the key is read from the build environment.
    if (AI_CONFIG.transport === 'direct' && AI_CONFIG.apiKey) {
        headers.Authorization = `Bearer ${AI_CONFIG.apiKey}`;
    }

    if (AI_CONFIG.transport === 'proxy') {
        const { data } = (await supabase?.auth.getSession()) ?? { data: { session: null } };
        if (!data.session) throw new AiError('SIGN_IN', 'Sign in to use Syn');

        headers.Authorization = `Bearer ${data.session.access_token}`;

        return { headers, userId: data.session.user.id };
    }

    return { headers, userId: null };
};

const classifyError = (error: unknown): AiError => {
    if (error instanceof AiError) return error;

    if (isAxiosError(error)) {
        const status = error.response?.status;
        const code = error.code;
        // The proxy says why in its own envelope: { error: { type, message } }.
        const reason = (error.response?.data as ChatCompletionResponse | undefined)?.error?.type;

        if (reason === 'monthly_quota') {
            return new AiError('USER_QUOTA', 'Monthly plan builds used up', status);
        }

        if (code && TIMEOUT_ERROR_CODES.has(code)) {
            return new AiError('TIMEOUT', 'The request timed out', status);
        }
        if (code && NETWORK_ERROR_CODES.has(code)) {
            return new AiError('NO_INTERNET', 'No usable connection', status);
        }
        if (status === 401 || status === 403) {
            return new AiError('AUTH', 'The provider rejected the credential', status);
        }
        if (status === 429) {
            return new AiError('RATE_LIMIT', 'Rate limited by the provider', status);
        }
        if (status === 402) {
            return new AiError('QUOTA', 'The provider account is out of credit', status);
        }
        if (status && RETRYABLE_HTTP_STATUSES.has(status)) {
            return new AiError('PROVIDER', 'The provider is unavailable', status);
        }

        const providerMessage = (error.response?.data as ChatCompletionResponse | undefined)?.error
            ?.message;

        return new AiError('PROVIDER', providerMessage ?? error.message, status);
    }

    return new AiError('UNKNOWN', error instanceof Error ? error.message : undefined);
};

export const requestCompletion = async ({
    messages,
    json = false,
    signal,
}: AiCompletionOptions): Promise<AiCompletionResult> => {
    if (!isAiEnabled()) {
        throw new AiError('DISABLED', 'AI is not configured for this build');
    }

    const body: Record<string, unknown> = {
        model: AI_CONFIG.model,
        // Fallbacks, for gateways that take them. Left out for a single model, so
        // a provider that rejects unknown fields never sees it.
        ...(AI_CONFIG.models.length > 1 ? { models: AI_CONFIG.models } : {}),
        messages,
        ...buildSamplingParameters(),
    };

    if (json) {
        body.response_format = { type: 'json_object' };
    }

    let userId: string | null = null;

    try {
        const request = await buildHeaders();
        userId = request.userId;

        const { data, headers } = await aiClient.post<ChatCompletionResponse>(
            buildCompletionsUrl(),
            body,
            { headers: request.headers, signal },
        );
        recordUsage(headers, userId);

        // Some gateways answer 200 with an error envelope rather than an HTTP error.
        if (data?.error?.message) {
            throw new AiError('PROVIDER', data.error.message);
        }

        const choice = data?.choices?.[0];
        const content = choice?.message?.content;

        if (typeof content !== 'string' || content.trim().length === 0) {
            throw new AiError('INVALID_RESPONSE', 'The provider returned an empty completion');
        }

        // A reply cut off at the token ceiling is not malformed JSON, it is an
        // incomplete one. Reporting it as a parse failure sends you looking in the
        // wrong place; the fix is a larger EXPO_PUBLIC_AI_MAX_TOKENS.
        if (choice?.finish_reason === 'length') {
            throw new AiError(
                'TRUNCATED',
                `The reply hit the ${AI_CONFIG.maxTokens}-token ceiling before it finished`,
            );
        }

        return {
            content,
            model: data.model ?? AI_CONFIG.model,
            promptTokens: data.usage?.prompt_tokens ?? null,
            completionTokens: data.usage?.completion_tokens ?? null,
        };
    } catch (error) {
        if (isAxiosError(error)) recordUsage(error.response?.headers, userId);

        const aiError = classifyError(error);

        // A truncation is retried shorter by the plan generator, and reported there
        // if the retry fails too — reporting it here showed an error for a plan
        // that then arrived.
        if (isReportableAiError(aiError) && aiError.code !== 'TRUNCATED') {
            reportError(aiError, 'ai.requestCompletion failed', {
                tags: { feature: 'ai', code: aiError.code },
                extras: { models: AI_CONFIG.models, transport: AI_CONFIG.transport },
            });
        }

        throw aiError;
    }
};
