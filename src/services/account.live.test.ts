// @ts-nocheck
import { describe, expect, jest, test } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { get, request } from 'node:https';
import { join } from 'node:path';

/**
 * The app's auth calls against the real Supabase project.
 *
 * Every other auth test fakes the server, so none of them can see the project's
 * own settings — which is where a sign-in that works in tests and fails on the
 * phone lives: an unlisted redirect URL, a disabled provider, a key the project
 * no longer accepts, an error shape the classifier does not recognise.
 *
 * Opt-in, because it needs the network and `.env.local`:
 *
 *   SUPABASE_LIVE=1 npx jest src/services/account.live.test.ts
 *
 * Read-only apart from one failed password sign-in for an address that does not
 * exist. The authorize probes send no PKCE challenge, so no flow state is stored.
 */

const mockEnv = (() => {
    try {
        const file = readFileSync(join(__dirname, '../../.env.local'), 'utf8');
        const read = (name: string) =>
            file
                .split(/\r?\n/)
                .find((line) => line.startsWith(`${name}=`))
                ?.slice(name.length + 1)
                .trim()
                .replace(/^"|"$/g, '') || null;

        return {
            url: read('EXPO_PUBLIC_SUPABASE_URL'),
            key: read('EXPO_PUBLIC_SUPABASE_ANON_KEY'),
        };
    } catch {
        return { url: null, key: null };
    }
})();

const live = process.env.SUPABASE_LIVE === '1' && !!mockEnv.url && !!mockEnv.key;

/**
 * A real network `fetch`. The React Native Jest preset's own is not one — calls
 * through it never reach a server — so supabase-js is handed this instead.
 */
const httpsFetch = (input: any, init: any = {}) =>
    new Promise((resolve, reject) => {
        const url = new URL(typeof input === 'string' ? input : input.url);
        const headers: Record<string, string> = {};
        const source = init.headers ?? {};
        if (typeof source.forEach === 'function') source.forEach((v, k) => (headers[k] = v));
        else Object.assign(headers, source);

        const req = request(url, { method: init.method ?? 'GET', headers }, (response) => {
            const chunks: Buffer[] = [];
            response.on('data', (chunk) => chunks.push(chunk));
            response.on('end', () => {
                const text = Buffer.concat(chunks).toString('utf8');
                const status = response.statusCode ?? 0;
                resolve({
                    ok: status >= 200 && status < 300,
                    status,
                    statusText: response.statusMessage ?? '',
                    headers: {
                        get: (name: string) => {
                            const value = response.headers[name.toLowerCase()];
                            return Array.isArray(value) ? value.join(', ') : (value ?? null);
                        },
                        has: (name: string) => name.toLowerCase() in response.headers,
                        forEach: () => undefined,
                    },
                    text: async () => text,
                    json: async () => JSON.parse(text),
                });
            });
        });

        req.on('error', reject);
        if (init.body) req.write(init.body);
        req.end();
    });

if (live) global.fetch = httpsFetch as any;

jest.mock('@/constants/auth', () => ({
    AUTH_CONFIG: {
        supabaseUrl: mockEnv.url,
        supabaseAnonKey: mockEnv.key,
        googleEnabled: true,
        emailEnabled: true,
    },
    isAuthConfigured: () => !!mockEnv.url && !!mockEnv.key,
    MIN_PASSWORD_LENGTH: 6,
}));

const mockMemory = new Map();
jest.mock('@/storage', () => ({
    storage: {
        getString: (key) => mockMemory.get(key),
        set: (key, value) => mockMemory.set(key, value),
        remove: (key) => mockMemory.delete(key),
    },
}));

jest.mock('@/services/error-reporting', () => ({ reportError: jest.fn() }));

jest.mock('expo-constants', () => ({
    __esModule: true,
    default: { expoConfig: { scheme: require('../../app.config.js').scheme } },
}));

jest.mock('expo-auth-session', () => ({
    makeRedirectUri: ({ scheme, path }) => `${scheme}://${path}`,
}));

jest.mock('expo-web-browser', () => ({
    openAuthSessionAsync: jest.fn(),
    maybeCompleteAuthSession: jest.fn(),
}));

/** GET without following redirects. */
const fetchLocation = (url: string): Promise<{ status: number; location: string | null }> =>
    new Promise((resolve, reject) => {
        get(url, { headers: { apikey: mockEnv.key! } }, (response) => {
            response.resume();
            resolve({
                status: response.statusCode ?? 0,
                location: response.headers.location ?? null,
            });
        }).on('error', reject);
    });

/**
 * Where Supabase will actually send the user back to.
 *
 * GoTrue checks `redirect_to` against the project's Redirect URLs and, if it is
 * not listed, silently substitutes the Site URL. `/verify` does that check on
 * every request, and a dud token makes it redirect at once with an error — to
 * the address it decided to honour. That is exactly the question "is this on
 * the allow-list?", asked without sending an email or starting a sign-in.
 */
const effectiveRedirect = async (redirectTo: string): Promise<string> => {
    const verify = `${mockEnv.url}/auth/v1/verify?type=signup&token=pkce_probe_not_a_real_token&redirect_to=${encodeURIComponent(
        redirectTo,
    )}`;
    const { status, location } = await fetchLocation(verify);

    if (!location) throw new Error(`verify answered ${status} with no redirect`);

    // Strip what GoTrue appended — its error params and the fragment — and
    // compare what is left with what was asked for.
    const [base] = location.split('#');
    const [path, query = ''] = base.split('?');
    const kept = query
        .split('&')
        .filter((pair) => pair && !/^(error|error_code|error_description)=/.test(pair));

    return kept.length > 0 ? `${path}?${kept.join('&')}` : path;
};

(live ? describe : describe.skip)('the live Supabase project', () => {
    jest.setTimeout(30_000);

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const account = require('@/services/account');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { supabase } = require('@/services/supabase');

    afterAll(() => supabase?.auth.stopAutoRefresh());

    test('accepts the app key and answers a bad password as bad credentials', async () => {
        const attempt = account.signInWithEmail(
            `nobody-${Date.now()}@example.invalid`,
            'definitely-not-it',
        );

        const error = await attempt.catch((caught) => caught);

        // The message rides along so a mismatch shows what the server really said.
        expect(`${error?.code} :: ${error?.message}`).toMatch(/^INVALID_CREDENTIALS :: /);
    });

    test.each([
        ['the sign-in / confirmation address', () => account.authRedirectUri()],
        ['the password-reset address', () => account.authRedirectUri('recovery')],
    ])('%s is on the Redirect URLs allow-list', async (_name, address) => {
        const redirectTo = address();

        // If this fails, the received value is where users are really sent: the
        // Site URL, which the app's browser sheet is not waiting for.
        expect(await effectiveRedirect(redirectTo)).toBe(redirectTo);
    });
});
