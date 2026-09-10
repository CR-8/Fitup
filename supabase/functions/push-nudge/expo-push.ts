import type { Env } from './types.ts';

/**
 * Expo's push API, not Firebase's directly.
 *
 * This is still "push via FCM" in every way that matters for an Expo app:
 * the `epsToken` every device already registers (see
 * `use-notifications.tsx`'s `getExpoPushTokenAsync`) is an Expo push token,
 * and Expo's push service is what actually delivers it — through FCM on
 * Android and APNs on iOS — using the credentials `eas credentials` already
 * configured for this project's builds. Calling FCM's own HTTP v1 API
 * directly would need a second, separate Firebase service-account credential
 * for no benefit: Android delivery still ends up going through the same FCM
 * project either way, and iOS would need APNs handled all over again by hand.
 *
 * https://docs.expo.dev/push-notifications/sending-notifications/
 */

const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';

/** Expo rejects a request over this; batching keeps every send well under it. */
const MAX_MESSAGES_PER_REQUEST = 100;

const EXPO_TOKEN_PATTERN = /^Expo(nent)?PushToken\[.+\]$/;

export interface PushMessage {
    to: string;
    title: string;
    body: string;
    data?: Record<string, unknown>;
}

interface ExpoTicket {
    status: 'ok' | 'error';
    id?: string;
    message?: string;
    details?: { error?: string };
}

const chunk = <T>(values: T[], size: number): T[][] => {
    const batches: T[][] = [];
    for (let index = 0; index < values.length; index += size) {
        batches.push(values.slice(index, index + size));
    }
    return batches;
};

/**
 * Sends every message, in batches of 100, and returns Expo's own per-message
 * tickets in the same order the messages went out. A ticket with
 * `status: 'error'` most often means `DeviceNotRegistered` — the token has
 * gone stale (uninstall, or the app cleared its Expo project) — which is
 * useful to know but is not treated as this run failing: the other
 * recipients' sends are unaffected by one dead token.
 */
export const sendPushMessages = async (
    env: Env,
    messages: PushMessage[],
): Promise<{ tickets: ExpoTicket[]; errors: number }> => {
    const valid = messages.filter((message) => EXPO_TOKEN_PATTERN.test(message.to));
    const skipped = messages.length - valid.length;

    if (skipped > 0) {
        console.warn(`push-nudge: skipped ${skipped} malformed push token(s)`);
    }

    const tickets: ExpoTicket[] = [];

    for (const batch of chunk(valid, MAX_MESSAGES_PER_REQUEST)) {
        const response = await fetch(EXPO_PUSH_ENDPOINT, {
            method: 'POST',
            headers: {
                accept: 'application/json',
                'accept-encoding': 'gzip, deflate',
                'content-type': 'application/json',
                ...(env.EXPO_ACCESS_TOKEN
                    ? { authorization: `Bearer ${env.EXPO_ACCESS_TOKEN}` }
                    : {}),
            },
            body: JSON.stringify(
                batch.map((message) => ({
                    to: message.to,
                    title: message.title,
                    body: message.body,
                    data: message.data,
                    // Expo's own default already, stated so a future change to
                    // that default cannot quietly change delivery priority here.
                    priority: 'default',
                })),
            ),
        });

        if (!response.ok) {
            const detail = await response.text();
            throw new Error(`Expo push API ${response.status}: ${detail.slice(0, 400)}`);
        }

        const body = (await response.json()) as { data?: ExpoTicket[] };
        tickets.push(...(body.data ?? []));
    }

    return {
        tickets,
        errors: tickets.filter((ticket) => ticket.status === 'error').length,
    };
};
