// @ts-nocheck
import { afterAll, afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import { createHash } from 'node:crypto';
import { useEffect } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

/**
 * Sign-in, end to end, as far as a test can reach.
 *
 * Every other auth test mocks Supabase as `null`, so none of them had ever seen a
 * sign-in succeed. This one runs the real screen, the real form, the real
 * `account` service, the real supabase-js client with PKCE, the real
 * `AccountProvider` and the real account preparation. What is faked is the
 * network (a small GoTrue that checks PKCE verifiers like the real one), the
 * router, and the local database behind `crud/user`.
 *
 * Presentational pieces with native animation (hero, spinner, pressable scale)
 * are stubbed; none of them take part in signing in.
 */

/* -------------------------------------------------------------------------- */
/* Fake GoTrue + PostgREST                                                    */
/* -------------------------------------------------------------------------- */

interface MockAccount {
    id: string;
    email: string;
    password: string;
    confirmed: boolean;
}

let mockAccounts: MockAccount[] = [];
let mockRequests: { method: string; path: string; body: any }[] = [];
let mockNetworkDown = false;
let mockOAuthChallenge: string | null = null;

const mockB64 = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');

const mockUserJson = (account: MockAccount, provider = 'email') => ({
    id: account.id,
    aud: 'authenticated',
    role: 'authenticated',
    email: account.email,
    email_confirmed_at: account.confirmed ? new Date().toISOString() : null,
    app_metadata: { provider, providers: [provider] },
    user_metadata: {},
    identities: [
        {
            identity_id: `identity-${account.id}`,
            id: account.id,
            user_id: account.id,
            provider,
            identity_data: { email: account.email, sub: account.id },
        },
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
});

const mockSessionJson = (account: MockAccount, provider = 'email') => {
    const now = Math.floor(Date.now() / 1000);

    return {
        access_token: `${mockB64({ alg: 'HS256', typ: 'JWT' })}.${mockB64({
            sub: account.id,
            email: account.email,
            aud: 'authenticated',
            role: 'authenticated',
            exp: now + 3600,
            iat: now,
            session_id: `session-${account.id}`,
        })}.signature`,
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: now + 3600,
        refresh_token: `refresh-${account.id}`,
        user: mockUserJson(account, provider),
    };
};

const mockReply = (status: number, body: unknown) => ({
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    headers: {
        get: (name: string) =>
            name.toLowerCase() === 'content-type' ? 'application/json; charset=utf-8' : null,
        has: () => false,
        forEach: () => undefined,
    },
    json: async () => body,
    text: async () => JSON.stringify(body),
});

/** GoTrue's own error shape for a 400. */
const mockAuthFailure = (errorCode: string, msg: string) =>
    mockReply(400, { code: 400, error_code: errorCode, msg });

const mockFetch = async (input: any, init: any = {}) => {
    if (mockNetworkDown) throw new TypeError('Network request failed');

    const url = new URL(typeof input === 'string' ? input : input.url);
    const method = String(init.method ?? 'GET').toUpperCase();
    const body = typeof init.body === 'string' && init.body ? JSON.parse(init.body) : undefined;

    mockRequests.push({ method, path: `${url.pathname}${url.search}`, body });

    const grant = url.searchParams.get('grant_type');

    if (url.pathname === '/auth/v1/token' && grant === 'password') {
        const account = mockAccounts.find(
            (candidate) => candidate.email === body.email && candidate.password === body.password,
        );

        if (!account) return mockAuthFailure('invalid_credentials', 'Invalid login credentials');
        if (!account.confirmed)
            return mockAuthFailure('email_not_confirmed', 'Email not confirmed');

        return mockReply(200, mockSessionJson(account));
    }

    if (url.pathname === '/auth/v1/signup') {
        const existing = mockAccounts.find((candidate) => candidate.email === body.email);

        // A confirmed address is reported as an ordinary success with no
        // identities: Supabase's anti-enumeration answer.
        if (existing?.confirmed)
            return mockReply(200, { ...mockUserJson(existing), identities: [] });

        const account = existing ?? {
            id: `account-${mockAccounts.length + 1}`,
            email: body.email,
            password: body.password,
            confirmed: false,
        };
        if (!existing) mockAccounts.push(account);

        // Confirmations are on in the live project (`mailer_autoconfirm: false`).
        return mockReply(200, mockUserJson(account));
    }

    if (url.pathname === '/auth/v1/token' && grant === 'pkce') {
        const challenge = createHash('sha256')
            .update(String(body.code_verifier ?? ''))
            .digest('base64url');

        if (body.auth_code !== 'google-code' || challenge !== mockOAuthChallenge) {
            return mockAuthFailure(
                'bad_code_verifier',
                'code challenge does not match previously saved code verifier',
            );
        }

        const google = mockAccounts.find((candidate) => candidate.email === 'google@example.com')!;
        return mockReply(200, mockSessionJson(google, 'google'));
    }

    if (url.pathname === '/auth/v1/logout') return mockReply(204, {});

    // No account in these tests has a backup yet.
    if (url.pathname.startsWith('/rest/v1/profiles')) return mockReply(200, []);

    return mockReply(404, { msg: `Not faked: ${method} ${url.pathname}` });
};

/* -------------------------------------------------------------------------- */
/* Module mocks                                                               */
/* -------------------------------------------------------------------------- */

const mockMemory = new Map<string, unknown>();

jest.mock('@/storage', () => ({
    storage: {
        getString: (key: string) => mockMemory.get(key) as string | undefined,
        getBoolean: (key: string) => mockMemory.get(key) as boolean | undefined,
        set: (key: string, value: unknown) => {
            mockMemory.set(key, value);
        },
        remove: (key: string) => mockMemory.delete(key),
    },
}));

jest.mock('@/constants/auth', () => ({
    AUTH_CONFIG: {
        supabaseUrl: 'https://fake-project.supabase.co',
        supabaseAnonKey: 'sb_publishable_test',
        googleEnabled: true,
        emailEnabled: true,
    },
    isAuthConfigured: () => true,
    MIN_PASSWORD_LENGTH: 6,
}));

const mockReplace = jest.fn();
const mockPush = jest.fn();
let mockParams: Record<string, string | undefined> = {};

jest.mock('expo-router', () => ({
    router: {
        replace: (path: string) => mockReplace(path),
        push: (path: string) => mockPush(path),
        navigate: (path: string) => mockPush(path),
        back: jest.fn(),
    },
    useLocalSearchParams: () => mockParams,
}));

jest.mock('expo-constants', () => ({
    __esModule: true,
    default: { expoConfig: { scheme: require('../../../../app.config.js').scheme } },
}));

jest.mock('expo-auth-session', () => ({
    makeRedirectUri: ({ scheme, path }: { scheme: string; path: string }) => `${scheme}://${path}`,
}));

const mockOpenAuthSession = jest.fn();
jest.mock('expo-web-browser', () => ({
    openAuthSessionAsync: (...args: unknown[]) => mockOpenAuthSession(...args),
    maybeCompleteAuthSession: () => ({ type: 'failed' }),
}));

jest.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
    initReactI18next: { type: '3rdParty', init: () => undefined },
}));

jest.mock('expo-localization', () => ({
    useLocales: () => [{ decimalSeparator: '.', digitGroupingSeparator: ',' }],
    getLocales: () => [{ decimalSeparator: '.', digitGroupingSeparator: ',' }],
}));

// The real button is a native SwiftUI / Compose view; a pressable label keeps
// it findable by its text here.
jest.mock('@/components/buttons/base', () => {
    const { createElement } = require('react');
    const { Pressable, Text } = require('react-native');

    return {
        Button: ({
            title,
            onPress,
            disabled,
        }: {
            title?: string;
            onPress?: () => void;
            disabled?: boolean;
        }) => createElement(Pressable, { onPress, disabled }, createElement(Text, null, title)),
    };
});

jest.mock('@/screens/auth/components/hero', () => ({ AuthHero: () => null }));
jest.mock('@/components/feedback/spinner', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/primitives/pressable', () => ({
    Pressable: require('react-native').Pressable,
}));

const mockReportError = jest.fn();
jest.mock('@/services/error-reporting', () => ({
    reportError: (...args: unknown[]) => mockReportError(...args),
    runInBackground: (task: any, context: string) => {
        try {
            const result = typeof task === 'function' ? task() : task;
            if (result && typeof result.then === 'function') {
                Promise.resolve(result).catch((error) => mockReportError(error, context));
            }
        } catch (error) {
            mockReportError(error, context);
        }
    },
}));

/** The local database, as `crud/user` presents it. */
let mockLocalUsers: { id: string; accountId: string | null; epsToken?: string | null }[] = [];

jest.mock('@/crud/user', () => ({
    getUserByAccountId: async (accountId: string) =>
        mockLocalUsers.find((row) => row.accountId === accountId) ?? null,
    resolveLocalUserForAccount: async (identity: any, preferredLocalUserId?: string) => {
        let row =
            mockLocalUsers.find((candidate) => candidate.accountId === identity.accountId) ??
            mockLocalUsers.find((candidate) => candidate.accountId === null);

        if (row) {
            row.accountId = identity.accountId;
        } else {
            row = {
                id: preferredLocalUserId ?? `local-${identity.accountId}`,
                accountId: identity.accountId,
            };
            mockLocalUsers.push(row);
        }

        return row;
    },
    getCurrentUser: async () => mockLocalUsers[0] ?? null,
}));

let mockOnboarded = new Set<string>();
jest.mock('@/crud/onboarding', () => ({
    hasCompletedOnboarding: async (userId: string) => mockOnboarded.has(userId),
}));

jest.mock('@/db', () => ({ db: {}, dbConnection: {} }));
jest.mock('@/crud/sync', () => ({ cleanupSyncedOperations: async () => 0 }));
jest.mock('@/queries', () => ({ queryClient: { invalidateQueries: async () => undefined } }));
jest.mock('@/services/backup/push', () => ({
    pushBackup: async () => true,
    pushEverything: async () => undefined,
}));
jest.mock('@/services/push-registration', () => ({ unregisterPushToken: async () => undefined }));

/* -------------------------------------------------------------------------- */
/* Load order: fetch and themes before any component module                  */
/* -------------------------------------------------------------------------- */

global.fetch = mockFetch as any;

require('react-native-unistyles/mocks');
require('../../../../unistyles');

const { Alert, Text, TextInput } = require('react-native');
const SignInScreen = require('./index').default;
const { AccountProvider, useAccount } = require('@/hooks/use-account');
const { supabase } = require('@/services/supabase');

const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

/* -------------------------------------------------------------------------- */
/* Harness                                                                    */
/* -------------------------------------------------------------------------- */

let latestAccount: ReturnType<typeof useAccount> | null = null;

const AccountProbe = () => {
    const account = useAccount();

    useEffect(() => {
        latestAccount = account;
    });

    return null;
};

let renderer: ReactTestRenderer | null = null;

const render = async () => {
    await act(async () => {
        renderer = create(
            <AccountProvider>
                <AccountProbe />
                <SignInScreen />
            </AccountProvider>,
        );
    });
    await waitFor(() => latestAccount?.isReady === true);
};

const flush = async (ms = 0) => {
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, ms));
    });
};

const waitFor = async (condition: () => boolean, timeoutMs = 4000) => {
    const started = Date.now();

    while (!condition()) {
        if (Date.now() - started > timeoutMs) {
            throw new Error(
                `Timed out. replace=${JSON.stringify(mockReplace.mock.calls)} push=${JSON.stringify(
                    mockPush.mock.calls,
                )} alert=${JSON.stringify(alertSpy.mock.calls)} requests=${JSON.stringify(
                    mockRequests.map((request) => `${request.method} ${request.path}`),
                )} reported=${JSON.stringify(mockReportError.mock.calls.map((call) => String(call[0])))}`,
            );
        }
        await flush(10);
    }
};

const root = (): ReactTestInstance => renderer!.root;

const typeInto = async (index: number, text: string) => {
    const inputs = root().findAllByType(TextInput);
    await act(async () => {
        inputs[index].props.onChangeText(text);
    });
};

/** Presses whatever pressable encloses the text with this key. */
const press = async (label: string) => {
    const [textNode] = root().findAll(
        (node) => node.type === Text && [].concat(node.props.children).includes(label),
    );
    if (!textNode) throw new Error(`No text "${label}" on screen`);

    let node: ReactTestInstance | null = textNode;
    while (node && typeof node.props.onPress !== 'function') node = node.parent;
    if (!node) throw new Error(`"${label}" is not inside anything pressable`);

    await act(async () => {
        node!.props.onPress();
    });
};

const signInWith = async (email: string, password: string) => {
    await typeInto(0, email);
    await typeInto(1, password);
    await press('signIn.continue');
};

/* -------------------------------------------------------------------------- */
/* Tests                                                                      */
/* -------------------------------------------------------------------------- */

jest.setTimeout(30000);

beforeEach(async () => {
    mockAccounts = [
        {
            id: 'account-returning',
            email: 'returning@example.com',
            password: 'correct-horse',
            confirmed: true,
        },
        { id: 'account-new', email: 'new@example.com', password: 'correct-horse', confirmed: true },
        {
            id: 'account-unconfirmed',
            email: 'pending@example.com',
            password: 'correct-horse',
            confirmed: false,
        },
        { id: 'account-google', email: 'google@example.com', password: '', confirmed: true },
    ];
    mockRequests = [];
    mockNetworkDown = false;
    mockOAuthChallenge = null;
    mockParams = {};
    mockLocalUsers = [{ id: 'local-anonymous', accountId: null }];
    mockOnboarded = new Set(['local-returning']);
    mockReplace.mockClear();
    mockPush.mockClear();
    mockOpenAuthSession.mockReset();
    mockReportError.mockClear();
    alertSpy.mockClear();
    latestAccount = null;

    // A clean device: no stored session, no leftover PKCE verifier.
    await supabase.auth.signOut({ scope: 'local' });
    mockMemory.clear();
});

afterEach(async () => {
    await act(async () => {
        renderer?.unmount();
    });
    renderer = null;
});

afterAll(() => {
    supabase.auth.stopAutoRefresh();
});

describe('email sign-in', () => {
    test('a returning, onboarded user lands on Home and is signed in', async () => {
        mockLocalUsers = [{ id: 'local-returning', accountId: 'account-returning' }];
        await render();

        await signInWith('returning@example.com', 'correct-horse');
        await waitFor(() => mockReplace.mock.calls.length > 0);

        expect(mockReplace).toHaveBeenCalledWith('/');
        expect(alertSpy).not.toHaveBeenCalled();

        await waitFor(() => latestAccount?.isSignedIn === true && latestAccount.isPrepared);
        expect(latestAccount!.session!.user.email).toBe('returning@example.com');
    });

    test('a first sign-in adopts the device row and goes to onboarding', async () => {
        await render();

        await signInWith('new@example.com', 'correct-horse');
        await waitFor(() => mockReplace.mock.calls.length > 0);

        expect(mockReplace).toHaveBeenCalledWith('/onboarding');
        expect(alertSpy).not.toHaveBeenCalled();
        expect(mockLocalUsers).toEqual([{ id: 'local-anonymous', accountId: 'account-new' }]);
    });

    test('the address is trimmed before it is sent', async () => {
        await render();

        await signInWith('  new@example.com  ', 'correct-horse');
        await waitFor(() => mockReplace.mock.calls.length > 0);

        const grant = mockRequests.find((request) => request.path.includes('grant_type=password'));
        expect(grant!.body.email).toBe('new@example.com');
        expect(alertSpy).not.toHaveBeenCalled();
    });

    test('a wrong password says so and stays on the form', async () => {
        await render();

        await signInWith('returning@example.com', 'wrong-password');
        await waitFor(() => alertSpy.mock.calls.length > 0);

        expect(alertSpy).toHaveBeenCalledWith('signIn.errors.invalidCredentials');
        expect(mockReplace).not.toHaveBeenCalled();
        expect(latestAccount!.isSignedIn).toBe(false);
    });

    test('the form can be submitted again after a failure', async () => {
        await render();

        await signInWith('returning@example.com', 'wrong-password');
        await waitFor(() => alertSpy.mock.calls.length > 0);

        await typeInto(1, 'correct-horse');
        await press('signIn.continue');
        await waitFor(() => mockReplace.mock.calls.length > 0);

        expect(latestAccount!.session).not.toBeNull();
    });

    test('an unconfirmed address is sent to check its email', async () => {
        await render();

        await signInWith('pending@example.com', 'correct-horse');
        await waitFor(() => mockPush.mock.calls.length > 0);

        expect(mockPush).toHaveBeenCalledWith(
            '/auth/check-email?email=pending%40example.com&reason=signup',
        );
        expect(alertSpy).not.toHaveBeenCalled();
    });

    test('no network is reported as no network', async () => {
        await render();
        mockNetworkDown = true;

        await signInWith('returning@example.com', 'correct-horse');
        await waitFor(() => alertSpy.mock.calls.length > 0);

        expect(alertSpy).toHaveBeenCalledWith('signIn.errors.network');
    });

    test('an invalid address never reaches the network', async () => {
        await render();

        await signInWith('not-an-email', 'correct-horse');
        await flush(50);

        expect(mockRequests.some((request) => request.path.includes('grant_type'))).toBe(false);
        expect(mockReplace).not.toHaveBeenCalled();
    });
});

describe('email sign-up', () => {
    test('a new address is sent to confirm it', async () => {
        await render();

        await press('signIn.needAccount');
        await typeInto(0, 'brand-new@example.com');
        await typeInto(1, 'correct-horse');
        await press('signIn.createAccount');
        await waitFor(() => mockPush.mock.calls.length > 0);

        expect(mockPush).toHaveBeenCalledWith(
            '/auth/check-email?email=brand-new%40example.com&reason=signup',
        );

        const signup = mockRequests.find((request) => request.path.startsWith('/auth/v1/signup'));
        expect(signup!.path).toContain(encodeURIComponent('fitsyn://auth/callback'));
    });

    test('an address that already has an account is told so', async () => {
        await render();

        await press('signIn.needAccount');
        await typeInto(0, 'returning@example.com');
        await typeInto(1, 'correct-horse');
        await press('signIn.createAccount');
        await waitFor(() => alertSpy.mock.calls.length > 0);

        expect(alertSpy).toHaveBeenCalledWith('signIn.errors.emailInUse');
    });
});

describe('Google sign-in', () => {
    test('the browser round trip signs in and lands on Home', async () => {
        mockLocalUsers = [{ id: 'local-returning', accountId: 'account-google' }];
        mockOnboarded = new Set(['local-returning']);

        mockOpenAuthSession.mockImplementation(async (authorizeUrl: string, returnUrl: string) => {
            const authorize = new URL(authorizeUrl);
            mockOAuthChallenge = authorize.searchParams.get('code_challenge');

            // What Supabase is asked to come back to must be what the browser
            // sheet is waiting for, or the sheet never closes.
            expect(authorize.searchParams.get('redirect_to')).toBe(returnUrl);

            return { type: 'success', url: `${returnUrl}?code=google-code` };
        });

        await render();
        await press('signIn.google');
        await waitFor(() => mockReplace.mock.calls.length > 0);

        expect(mockReplace).toHaveBeenCalledWith('/');
        expect(alertSpy).not.toHaveBeenCalled();
        await waitFor(() => latestAccount?.session?.user.email === 'google@example.com');
    });

    test('backing out of the browser is not an error', async () => {
        mockOpenAuthSession.mockResolvedValue({ type: 'cancel' });

        await render();
        await press('signIn.google');
        await flush(50);

        expect(alertSpy).not.toHaveBeenCalled();
        expect(mockReplace).not.toHaveBeenCalled();
    });
});
