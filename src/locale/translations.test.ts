import { readFileSync } from 'node:fs';

import { describe, expect, test } from '@jest/globals';

import generated from './translations/resources.json';

/**
 * Guards that the generated translation bundle matches its sources.
 *
 * The app imports `translations/resources.json`, which `bun run locale` builds
 * from `resources/<lng>/<ns>.json`. Editing a source without regenerating is
 * silent in every other check: the JSON is valid, typecheck passes, tests pass,
 * and the app renders the raw key on a screen nobody happens to open.
 *
 * That has already happened twice. This test is the thing that would have said
 * so immediately.
 */

const LOCALES = ['en', 'ru', 'zh', 'es', 'hi'] as const;
const NAMESPACES = ['common', 'menu', 'screens'] as const;

const readSource = (locale: string, namespace: string): unknown =>
    JSON.parse(readFileSync(`./src/locale/resources/${locale}/${namespace}.json`, 'utf8'));

describe('generated translation bundle', () => {
    test.each(LOCALES.flatMap((locale) => NAMESPACES.map((ns) => [locale, ns] as const)))(
        '%s/%s matches its source file',
        (locale, namespace) => {
            const bundled = (generated as Record<string, Record<string, unknown>>)[locale]?.[
                namespace
            ];

            // A mismatch means someone edited src/locale/resources and did not
            // run `bun run locale`. Run it, and commit the regenerated file.
            expect(bundled).toEqual(readSource(locale, namespace));
        },
    );

    test('covers every locale the app ships', () => {
        expect(Object.keys(generated as object).sort()).toEqual([...LOCALES].sort());
    });
});
