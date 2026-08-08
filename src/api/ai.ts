import { create as createAxios, isAxiosError } from 'axios';

import {
    AI_CONFIG,
    buildCompletionsUrl,
    buildSamplingParameters,
    isAiEnabled,
} from '@/constants/ai';
import { reportError } from '@/services/error-reporting';
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
    'NO_INTERNET',
    'TIMEOUT',
    'RATE_LIMIT',
    'QUOTA',
    'DISABLED',
]);

const aiClient = createAxios({ timeout: AI_CONFIG.timeoutMs });

const buildHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...AI_CONFIG.headers,
    };

    // In proxy mode the backend attaches the provider credential; the device never
    // holds one. In direct mode the key is read from the build environment.
    if (AI_CONFIG.transport === 'direct' && AI_CONFIG.apiKey) {
        headers.Authorization = `Bearer ${AI_CONFIG.apiKey}`;
    }

    return headers;
};

const classifyError = (error: unknown): AiError => {
    if (error instanceof AiError) return error;

    if (isAxiosError(error)) {
        const status = error.response?.status;
        const code = error.code;

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
        messages,
        ...buildSamplingParameters(),
    };

    if (json) {
        body.response_format = { type: 'json_object' };
    }

    try {
        const { data } = await aiClient.post<ChatCompletionResponse>(buildCompletionsUrl(), body, {
            headers: buildHeaders(),
            signal,
        });

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
        const aiError = classifyError(error);

        if (!SUPPRESS_SENTRY_CODES.has(aiError.code)) {
            reportError(aiError, 'ai.requestCompletion failed', {
                tags: { feature: 'ai', code: aiError.code },
                extras: { model: AI_CONFIG.model, transport: AI_CONFIG.transport },
            });
        }

        throw aiError;
    }
};
