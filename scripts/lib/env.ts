import { existsSync, readFileSync } from 'node:fs';

/**
 * Loads .env.local into process.env for the seeding scripts.
 *
 * These scripts run under `tsx`, which bun spawns as a child process. Bun reads
 * .env.local into its own runtime but does not export it to children, so
 * without this the scripts see none of the credentials they instruct people to
 * put there — and fail claiming the values are missing while they sit in the
 * file. The app itself is unaffected: Expo's own loader handles the bundle.
 *
 * No dependency for this. It parses KEY=VALUE, which is all these files contain.
 */

const ENV_FILES = ['.env.local', '.env'] as const;

/** Strips one layer of matching quotes, which people add out of habit. */
const unquote = (value: string): string => {
    const trimmed = value.trim();

    if (
        (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length > 1) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length > 1)
    ) {
        return trimmed.slice(1, -1);
    }

    return trimmed;
};

export const loadEnvFiles = (): void => {
    for (const file of ENV_FILES) {
        if (!existsSync(file)) continue;

        for (const line of readFileSync(file, 'utf8').split('\n')) {
            const trimmed = line.trim();
            if (trimmed.length === 0 || trimmed.startsWith('#')) continue;

            const separator = trimmed.indexOf('=');
            if (separator <= 0) continue;

            const key = trimmed.slice(0, separator).trim();
            if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;

            // A value already in the environment wins, so an inline
            // `FOO=bar bun run seed` still overrides the file — which is how
            // these scripts get tested against throwaway credentials.
            if (process.env[key] !== undefined) continue;

            const value = unquote(trimmed.slice(separator + 1));
            if (value.length > 0) process.env[key] = value;
        }
    }
};
