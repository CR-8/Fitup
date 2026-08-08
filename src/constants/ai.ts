/**
 * AI provider configuration.
 *
 * Every knob is environment-driven so the provider can be swapped without a code
 * change. The client speaks the OpenAI chat-completions wire format, which is what
 * OpenAI, OpenRouter, ZenMux, Together, Groq, Fireworks, vLLM, Ollama, and most
 * gateway products expose. Pointing EXPO_PUBLIC_AI_BASE_URL at a different gateway
 * is normally the only change required to move between providers.
 *
 * Anthropic's own API uses a different request shape. Reach Claude models through a
 * gateway that presents an OpenAI-compatible surface (OpenRouter, ZenMux) rather
 * than pointing this client at api.anthropic.com directly.
 */

export type AiTransportMode = 'proxy' | 'direct';

const DEFAULT_COMPLETIONS_PATH = '/chat/completions';
const DEFAULT_MODEL = 'gpt-4o-mini';
const DEFAULT_TEMPERATURE = 0.4;
/**
 * Generous by design. This is a ceiling, not an allocation — you are billed for the
 * tokens actually produced, so headroom is close to free while running out is a hard
 * failure that loses the whole reply.
 *
 * Reasoning models (GLM, DeepSeek-R1, o-series, Qwen-QwQ) spend part of this budget
 * thinking before they emit a character of the answer, so a ceiling sized for the
 * visible output alone will truncate them mid-structure.
 */
const DEFAULT_MAX_TOKENS = 8000;
const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_MONTHLY_QUOTA = 3;

const readString = (value: string | undefined): string | null => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
};

const readNumber = (value: string | undefined, fallback: number | null): number | null => {
    const raw = readString(value);
    if (raw === null) return fallback;

    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const readBoolean = (value: string | undefined, fallback: boolean): boolean => {
    const raw = readString(value)?.toLowerCase();
    if (raw === null || raw === undefined) return fallback;
    return raw === 'true' || raw === '1' || raw === 'yes';
};

/**
 * Extra headers as a JSON object, for gateways that require them. OpenRouter, for
 * example, attributes traffic with HTTP-Referer and X-Title.
 *
 * EXPO_PUBLIC_AI_HEADERS='{"HTTP-Referer":"https://fitup.app","X-Title":"Fitup"}'
 */
const readHeaders = (value: string | undefined): Record<string, string> => {
    const raw = readString(value);
    if (!raw) return {};

    try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

        return Object.entries(parsed).reduce<Record<string, string>>((acc, [key, entry]) => {
            if (typeof entry === 'string') acc[key] = entry;
            return acc;
        }, {});
    } catch {
        // A malformed header blob must not prevent the app from starting.
        return {};
    }
};

const baseUrl = readString(process.env.EXPO_PUBLIC_AI_BASE_URL);
const apiKey = readString(process.env.EXPO_PUBLIC_AI_API_KEY);

/**
 * `proxy` sends requests to your own backend, which holds the provider credential.
 * `direct` sends them to the provider from the device, which requires shipping a key
 * inside the app binary — acceptable for a personal or self-hosted build, never for a
 * store release. The mode is inferred from whether a key is present, and can be
 * pinned explicitly with EXPO_PUBLIC_AI_TRANSPORT.
 */
const transport: AiTransportMode =
    readString(process.env.EXPO_PUBLIC_AI_TRANSPORT) === 'direct' || apiKey !== null
        ? 'direct'
        : 'proxy';

export const AI_CONFIG = {
    enabled: readBoolean(process.env.EXPO_PUBLIC_AI_ENABLED, baseUrl !== null),
    transport,

    baseUrl,
    completionsPath:
        readString(process.env.EXPO_PUBLIC_AI_COMPLETIONS_PATH) ?? DEFAULT_COMPLETIONS_PATH,
    apiKey,
    headers: readHeaders(process.env.EXPO_PUBLIC_AI_HEADERS),
    timeoutMs: readNumber(process.env.EXPO_PUBLIC_AI_TIMEOUT_MS, DEFAULT_TIMEOUT_MS)!,

    model: readString(process.env.EXPO_PUBLIC_AI_MODEL) ?? DEFAULT_MODEL,

    // Sampling. Null means "omit from the request" so the provider's own default
    // applies — important because not every gateway accepts every parameter.
    temperature: readNumber(process.env.EXPO_PUBLIC_AI_TEMPERATURE, DEFAULT_TEMPERATURE),
    topP: readNumber(process.env.EXPO_PUBLIC_AI_TOP_P, null),
    maxTokens: readNumber(process.env.EXPO_PUBLIC_AI_MAX_TOKENS, DEFAULT_MAX_TOKENS),
    frequencyPenalty: readNumber(process.env.EXPO_PUBLIC_AI_FREQUENCY_PENALTY, null),
    presencePenalty: readNumber(process.env.EXPO_PUBLIC_AI_PRESENCE_PENALTY, null),
    seed: readNumber(process.env.EXPO_PUBLIC_AI_SEED, null),

    monthlyQuota: readNumber(process.env.EXPO_PUBLIC_AI_MONTHLY_QUOTA, DEFAULT_MONTHLY_QUOTA)!,
} as const;

/**
 * Sampling parameters are clamped to the ranges the OpenAI-compatible surface
 * accepts. A value outside these ranges is rejected by the provider with a 400, which
 * surfaces to the user as a generic failure and is tedious to diagnose from a device.
 * Clamping locally turns a misconfigured environment into a working request.
 */
const clamp = (value: number, min: number, max: number): number =>
    Math.min(Math.max(value, min), max);

export const buildSamplingParameters = () => {
    const params: Record<string, number> = {};

    if (AI_CONFIG.temperature !== null) {
        params.temperature = clamp(AI_CONFIG.temperature, 0, 2);
    }
    if (AI_CONFIG.topP !== null) {
        params.top_p = clamp(AI_CONFIG.topP, 0, 1);
    }
    if (AI_CONFIG.maxTokens !== null) {
        params.max_tokens = Math.max(1, Math.round(AI_CONFIG.maxTokens));
    }
    if (AI_CONFIG.frequencyPenalty !== null) {
        params.frequency_penalty = clamp(AI_CONFIG.frequencyPenalty, -2, 2);
    }
    if (AI_CONFIG.presencePenalty !== null) {
        params.presence_penalty = clamp(AI_CONFIG.presencePenalty, -2, 2);
    }
    if (AI_CONFIG.seed !== null) {
        params.seed = Math.round(AI_CONFIG.seed);
    }

    return params;
};

export const isAiEnabled = (): boolean => AI_CONFIG.enabled && AI_CONFIG.baseUrl !== null;

export const buildCompletionsUrl = (): string => {
    const base = (AI_CONFIG.baseUrl ?? '').replace(/\/+$/, '');
    const path = AI_CONFIG.completionsPath.startsWith('/')
        ? AI_CONFIG.completionsPath
        : `/${AI_CONFIG.completionsPath}`;

    return `${base}${path}`;
};

export const AI_PLAN_KINDS = ['workout', 'nutrition', 'combined'] as const;
export type AiPlanKind = (typeof AI_PLAN_KINDS)[number];

export const AI_MESSAGE_ROLES = ['user', 'assistant', 'system'] as const;
export type AiMessageRole = (typeof AI_MESSAGE_ROLES)[number];

export const AI_PLAN_STATUSES = ['draft', 'applied', 'discarded'] as const;
export type AiPlanStatus = (typeof AI_PLAN_STATUSES)[number];

/** Conversation turns sent as context. Older turns are dropped to bound token cost. */
export const AI_CONTEXT_MESSAGE_LIMIT = 12;

/** Catalogue exercises offered to the model per request (see SRS 5.13.4). */
export const AI_EXERCISE_CANDIDATE_LIMIT = 60;

/** Recent workouts summarised into the context window. */
export const AI_HISTORY_WORKOUT_LIMIT = 10;
