import { describe, expect, test } from '@jest/globals';

import { nameTokens, transliterateName } from './dataset';
import hindiNameTokens from '../data/exercise-name-tokens.hi.json';

/**
 * Guards the Hindi exercise names.
 *
 * The catalogue's 1,324 names are composed from a 525-word map rather than
 * translated one string at a time, which is what keeps `dumbbell` reading as
 * `डंबल` in all 285 names that contain it. The risk that buys is a name that
 * comes out half-Latin because the dataset grew a word nobody mapped — silent,
 * and only visible to someone reading Hindi. So the composer throws, and this
 * holds it to that.
 */

const tokens: Record<string, string> = hindiNameTokens;

describe('transliterateName', () => {
    test('reads as gym Hindi, not translated Hindi', () => {
        expect(transliterateName('barbell bench press', tokens)).toBe('बारबेल बेंच प्रेस');
    });

    test('keeps the punctuation that tells two variations apart', () => {
        // 322 of the catalogue's names lean on these to distinguish themselves,
        // so a composer that dropped them would collapse distinct exercises into
        // the same string.
        expect(transliterateName('push-up (wall) v. 2', tokens)).toBe('पुश-अप (वॉल) वी. 2');
    });

    test('leaves digits alone', () => {
        expect(transliterateName('sled 45 leg press', tokens)).toBe('स्लेड 45 लेग प्रेस');
    });

    test('repairs the degree sign the dataset mangled', () => {
        // Upstream ships `в°` — a `°` decoded once as cp1251. Four names carry it.
        expect(transliterateName('sled 45в° calf press', tokens)).toBe('स्लेड 45° काफ़ प्रेस');
    });

    test('refuses to emit a half-Latin name', () => {
        expect(() => transliterateName('barbell frobnicate', tokens)).toThrow(/frobnicate/);
    });
});

describe('the Hindi token map', () => {
    test('has no Latin left in it', () => {
        const latin = Object.entries(tokens).filter(([, hindi]) => /[a-z]/i.test(hindi));

        expect(latin).toEqual([]);
    });

    test('covers every word the composer would meet', () => {
        // `nameTokens` is what the seed run audits the dataset with; running it
        // over the map's own keys proves the two agree on what a word is.
        const keys = Object.keys(tokens);

        expect(nameTokens(keys)).toEqual([...keys].sort());
    });
});
