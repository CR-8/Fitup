/**
 * The AI config module reads process.env at import time, so each case resets the
 * module registry and re-imports with a fresh environment.
 */

import { afterEach, describe, expect, jest, test } from '@jest/globals';

const ENV_KEYS = [
    'EXPO_PUBLIC_AI_BASE_URL',
    'EXPO_PUBLIC_AI_COMPLETIONS_PATH',
    'EXPO_PUBLIC_AI_API_KEY',
    'EXPO_PUBLIC_AI_TRANSPORT',
    'EXPO_PUBLIC_AI_MODEL',
    'EXPO_PUBLIC_AI_TEMPERATURE',
    'EXPO_PUBLIC_AI_TOP_P',
    'EXPO_PUBLIC_AI_MAX_TOKENS',
    'EXPO_PUBLIC_AI_FREQUENCY_PENALTY',
    'EXPO_PUBLIC_AI_PRESENCE_PENALTY',
    'EXPO_PUBLIC_AI_SEED',
    'EXPO_PUBLIC_AI_HEADERS',
    'EXPO_PUBLIC_AI_ENABLED',
    'EXPO_PUBLIC_AI_MONTHLY_QUOTA',
] as const;

const loadConfig = (env: Partial<Record<(typeof ENV_KEYS)[number], string>>) => {
    jest.resetModules();

    for (const key of ENV_KEYS) {
        delete process.env[key];
    }
    for (const [key, value] of Object.entries(env)) {
        process.env[key] = value;
    }

    // A static import would bind once, before the environment is set. Re-requiring
    // after resetModules is what lets each case observe a different configuration.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('./ai') as typeof import('./ai');
};

afterEach(() => {
    for (const key of ENV_KEYS) {
        delete process.env[key];
    }
});

describe('AI configuration', () => {
    test('is disabled when no base URL is configured', () => {
        const { isAiEnabled } = loadConfig({});
        expect(isAiEnabled()).toBe(false);
    });

    test('enables itself once a base URL is present', () => {
        const { isAiEnabled } = loadConfig({
            EXPO_PUBLIC_AI_BASE_URL: 'https://api.example.test/v1',
        });
        expect(isAiEnabled()).toBe(true);
    });

    test('can be force-disabled even with a base URL', () => {
        const { isAiEnabled } = loadConfig({
            EXPO_PUBLIC_AI_BASE_URL: 'https://api.example.test/v1',
            EXPO_PUBLIC_AI_ENABLED: 'false',
        });
        expect(isAiEnabled()).toBe(false);
    });

    test('builds the completions URL without duplicating slashes', () => {
        const { buildCompletionsUrl } = loadConfig({
            EXPO_PUBLIC_AI_BASE_URL: 'https://api.example.test/v1/',
        });
        expect(buildCompletionsUrl()).toBe('https://api.example.test/v1/chat/completions');
    });

    test('honours a custom completions path', () => {
        const { buildCompletionsUrl } = loadConfig({
            EXPO_PUBLIC_AI_BASE_URL: 'https://gateway.example.test',
            EXPO_PUBLIC_AI_COMPLETIONS_PATH: 'v2/completions',
        });
        expect(buildCompletionsUrl()).toBe('https://gateway.example.test/v2/completions');
    });

    test('defaults to proxy transport when no key is supplied', () => {
        const { AI_CONFIG } = loadConfig({
            EXPO_PUBLIC_AI_BASE_URL: 'https://api.example.test/v1',
        });
        expect(AI_CONFIG.transport).toBe('proxy');
    });

    test('switches to direct transport when a key is supplied', () => {
        const { AI_CONFIG } = loadConfig({
            EXPO_PUBLIC_AI_BASE_URL: 'https://api.example.test/v1',
            EXPO_PUBLIC_AI_API_KEY: 'sk-test',
        });
        expect(AI_CONFIG.transport).toBe('direct');
    });

    test('reads the model from the environment', () => {
        const { AI_CONFIG } = loadConfig({
            EXPO_PUBLIC_AI_BASE_URL: 'https://openrouter.ai/api/v1',
            EXPO_PUBLIC_AI_MODEL: 'anthropic/claude-sonnet-4',
        });
        expect(AI_CONFIG.model).toBe('anthropic/claude-sonnet-4');
    });

    test('parses extra headers from a JSON blob', () => {
        const { AI_CONFIG } = loadConfig({
            EXPO_PUBLIC_AI_BASE_URL: 'https://openrouter.ai/api/v1',
            EXPO_PUBLIC_AI_HEADERS: '{"HTTP-Referer":"https://fitup.app","X-Title":"Fitup"}',
        });
        expect(AI_CONFIG.headers).toEqual({
            'HTTP-Referer': 'https://fitup.app',
            'X-Title': 'Fitup',
        });
    });

    test('ignores a malformed header blob rather than crashing at import', () => {
        const { AI_CONFIG } = loadConfig({
            EXPO_PUBLIC_AI_BASE_URL: 'https://api.example.test/v1',
            EXPO_PUBLIC_AI_HEADERS: 'not json',
        });
        expect(AI_CONFIG.headers).toEqual({});
    });
});

describe('sampling parameters', () => {
    test('emits the documented defaults', () => {
        const { buildSamplingParameters } = loadConfig({
            EXPO_PUBLIC_AI_BASE_URL: 'https://api.example.test/v1',
        });

        // The ceiling is deliberately generous: reasoning models spend part of the
        // budget thinking, and running out truncates the reply beyond recovery.
        expect(buildSamplingParameters()).toEqual({ temperature: 0.4, max_tokens: 8000 });
    });

    test('omits parameters that were never configured', () => {
        const { buildSamplingParameters } = loadConfig({
            EXPO_PUBLIC_AI_BASE_URL: 'https://api.example.test/v1',
        });

        const params = buildSamplingParameters();

        expect(params).not.toHaveProperty('top_p');
        expect(params).not.toHaveProperty('seed');
        expect(params).not.toHaveProperty('frequency_penalty');
    });

    test('passes through every configured sampling knob', () => {
        const { buildSamplingParameters } = loadConfig({
            EXPO_PUBLIC_AI_BASE_URL: 'https://api.example.test/v1',
            EXPO_PUBLIC_AI_TEMPERATURE: '0.9',
            EXPO_PUBLIC_AI_TOP_P: '0.8',
            EXPO_PUBLIC_AI_MAX_TOKENS: '1500',
            EXPO_PUBLIC_AI_FREQUENCY_PENALTY: '0.3',
            EXPO_PUBLIC_AI_PRESENCE_PENALTY: '-0.2',
            EXPO_PUBLIC_AI_SEED: '42',
        });

        expect(buildSamplingParameters()).toEqual({
            temperature: 0.9,
            top_p: 0.8,
            max_tokens: 1500,
            frequency_penalty: 0.3,
            presence_penalty: -0.2,
            seed: 42,
        });
    });

    test('clamps a temperature above the accepted range', () => {
        // The originating brief specified "temperature 200", which the API rejects.
        const { buildSamplingParameters } = loadConfig({
            EXPO_PUBLIC_AI_BASE_URL: 'https://api.example.test/v1',
            EXPO_PUBLIC_AI_TEMPERATURE: '200',
        });

        expect(buildSamplingParameters().temperature).toBe(2);
    });

    test('clamps a negative temperature to zero', () => {
        const { buildSamplingParameters } = loadConfig({
            EXPO_PUBLIC_AI_BASE_URL: 'https://api.example.test/v1',
            EXPO_PUBLIC_AI_TEMPERATURE: '-5',
        });

        expect(buildSamplingParameters().temperature).toBe(0);
    });

    test('clamps top_p into the unit interval', () => {
        const { buildSamplingParameters } = loadConfig({
            EXPO_PUBLIC_AI_BASE_URL: 'https://api.example.test/v1',
            EXPO_PUBLIC_AI_TOP_P: '4',
        });

        expect(buildSamplingParameters().top_p).toBe(1);
    });

    test('falls back to the default when a value is not a number', () => {
        const { buildSamplingParameters } = loadConfig({
            EXPO_PUBLIC_AI_BASE_URL: 'https://api.example.test/v1',
            EXPO_PUBLIC_AI_TEMPERATURE: 'hot',
        });

        expect(buildSamplingParameters().temperature).toBe(0.4);
    });

    test('rounds a fractional max_tokens to a usable integer', () => {
        const { buildSamplingParameters } = loadConfig({
            EXPO_PUBLIC_AI_BASE_URL: 'https://api.example.test/v1',
            EXPO_PUBLIC_AI_MAX_TOKENS: '0.4',
        });

        // The brief's "0.4 token limit" would floor to zero and be rejected.
        expect(buildSamplingParameters().max_tokens).toBe(1);
    });
});
