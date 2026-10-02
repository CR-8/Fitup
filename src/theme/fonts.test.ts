import { describe, expect, jest, test } from '@jest/globals';

import {
    bodyFontFamily,
    displayFontFamily,
    FONT_FAMILIES,
    usesBrandTypefaces,
} from '@/theme/fonts';

/**
 * The rule these guard is not a preference, it is a correctness one: DM Sans and
 * Space Grotesk contain no Cyrillic, Devanagari or CJK glyphs at all. Applying
 * them to a Hindi, Russian or Chinese interface would render it as empty boxes.
 */

jest.mock('@/locale/i18n', () => ({ __esModule: true, default: { language: 'en' } }));

describe('which languages get the brand typefaces', () => {
    test.each(['en', 'en-GB', 'en-US'])('%s is Latin, so it gets them', (language) => {
        expect(usesBrandTypefaces(language)).toBe(true);
    });

    // Hindi is the shipped case. The other three are languages the app used to
    // offer, kept here because the guard is what makes a stale stored language
    // render as text rather than as rows of empty boxes.
    test.each([
        ['hi', 'Devanagari'],
        ['hi-IN', 'Devanagari'],
        ['ru', 'Cyrillic'],
        ['zh', 'Han'],
        ['es', 'Latin but not shipped'],
    ])('%s is %s, so it keeps the system font', (language) => {
        expect(usesBrandTypefaces(language)).toBe(false);
    });

    test('an unknown or empty language keeps the system font', () => {
        expect(usesBrandTypefaces('')).toBe(false);
        expect(usesBrandTypefaces('ar')).toBe(false);
    });
});

describe('choosing a face for a weight', () => {
    test('each named weight maps to its own file', () => {
        expect(bodyFontFamily(400)).toBe(FONT_FAMILIES.body[400]);
        expect(bodyFontFamily(500)).toBe(FONT_FAMILIES.body[500]);
        expect(bodyFontFamily(600)).toBe(FONT_FAMILIES.body[600]);
        expect(bodyFontFamily(700)).toBe(FONT_FAMILIES.body[700]);
    });

    // The app's scale goes to 900; neither family does. Falling back beats
    // letting the platform smear a real 700 into a fake 900.
    test.each([800, 900])('weight %s falls back to the boldest real cut', (weight) => {
        expect(bodyFontFamily(weight)).toBe(FONT_FAMILIES.body[700]);
        expect(displayFontFamily(weight)).toBe(FONT_FAMILIES.display[700]);
    });

    test('the display family starts at 500, so lighter requests round up', () => {
        expect(displayFontFamily(400)).toBe(FONT_FAMILIES.display[500]);
    });

    test('no weight ever resolves to nothing', () => {
        for (const weight of [100, 300, 400, 450, 550, 650, 750, 900]) {
            expect(bodyFontFamily(weight)).toBeTruthy();
            expect(displayFontFamily(weight)).toBeTruthy();
        }
    });

    test('every family name is registered under a distinct key', () => {
        const names = [
            ...Object.values(FONT_FAMILIES.body),
            ...Object.values(FONT_FAMILIES.display),
        ];

        expect(new Set(names).size).toBe(names.length);
    });
});
