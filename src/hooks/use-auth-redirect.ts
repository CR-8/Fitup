import { useEffect, useState } from 'react';

import { peekAuthRedirect, subscribeToAuthRedirect } from '@/services/auth-redirect';

/**
 * The auth redirect, whether it arrived before this screen existed or after.
 *
 * Seeded from the store rather than fetched, which is the whole point: the
 * screen that handles the redirect is mounted as a *result* of it, so by its
 * first render the URL has already been and gone.
 */
export const useAuthRedirect = (): string | null => {
    const [url, setUrl] = useState<string | null>(peekAuthRedirect);

    useEffect(() => subscribeToAuthRedirect(setUrl), []);

    return url;
};
