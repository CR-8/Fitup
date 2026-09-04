import { isFitupExerciseUserId } from '@/constants/fitup';

/**
 * Catalogue exercise names, capitalised for display.
 *
 * All 1,324 names in the shipped dataset are stored entirely lowercase —
 * "kettlebell two arm clean", "ez-bar close-grip bench press". They are left
 * that way in the database: search indexes them, the sync carries it, and the
 * D1 catalogue is the source. This is a display concern and stays one.
 *
 * Only the catalogue is touched. A name someone typed themselves is returned
 * exactly as typed, because capitalising it would override a decision they
 * made — "5x5 DB press" is not improved by becoming "5X5 Db Press".
 *
 * The rules below are not guesses; each one is a case that actually occurs in
 * the dataset, with the count that made it worth handling.
 */

/**
 * Kept lowercase unless they open the name or a bracket. Counted in the
 * catalogue: on 69, to 13, and 11, the 7, in 4, a 4, of 3, off 2.
 */
const MINOR_WORDS = new Set([
    'a',
    'an',
    'and',
    'as',
    'at',
    'by',
    'for',
    'from',
    'in',
    'of',
    'off',
    'on',
    'onto',
    'or',
    'per',
    'the',
    'to',
    'vs',
    'with',
]);

/** Written lowercase in the dataset, read as initials. */
const ACRONYMS = new Map([
    ['ez', 'EZ'],
    ['jm', 'JM'],
    ['bosu', 'BOSU'],
    ['rdl', 'RDL'],
]);

/**
 * Not an abbreviation for anything — it marks a variant, as in
 * "push-up (wall) v. 2". Appears 40 times, and "V. 2" reads like a heading.
 */
const VERSION_MARKER = 'v.';

/** A lone letter before a hyphen names the equipment: t-bar, v-bar, u-bar. */
const isEquipmentInitial = (part: string, index: number, parts: string[]): boolean =>
    part.length === 1 && parts.length > 1 && index === 0 && /[a-z]/.test(part);

const capitalise = (word: string): string => {
    // Skips anything not starting with a letter, so "45°", "180" and "(male)"
    // keep their shape and the bracket is handled by the caller.
    const at = word.search(/[a-z0-9]/i);
    if (at === -1) return word;

    return word.slice(0, at) + word[at].toUpperCase() + word.slice(at + 1);
};

/**
 * Hyphenated words are capitalised part by part — "close-grip" is
 * "Close-Grip" — but a minor word inside one stays down, which is what makes
 * "elbow-to-knee" read correctly.
 */
const formatHyphenated = (word: string): string => {
    const parts = word.split('-');

    return parts
        .map((part, index) => {
            const bare = part.replace(/[^a-z0-9]/gi, '').toLowerCase();

            if (ACRONYMS.has(bare)) return part.replace(bare, ACRONYMS.get(bare)!);
            if (isEquipmentInitial(bare, index, parts)) return capitalise(part);
            if (index > 0 && MINOR_WORDS.has(bare)) return part;

            return capitalise(part);
        })
        .join('-');
};

const formatWord = (word: string, isFirst: boolean, opensBracket: boolean): string => {
    const bare = word.replace(/[^a-z0-9.]/gi, '').toLowerCase();

    if (bare === VERSION_MARKER) return word;
    if (ACRONYMS.has(bare)) return word.replace(new RegExp(bare, 'i'), ACRONYMS.get(bare)!);

    // A minor word still leads with a capital when it opens the name, or opens
    // a parenthetical: "(With Support)".
    if (!isFirst && !opensBracket && MINOR_WORDS.has(bare)) return word.toLowerCase();

    return word.includes('-') ? formatHyphenated(word) : capitalise(word);
};

export const toTitleCase = (name: string): string => {
    const words = name.trim().split(/\s+/);

    // The bracket travels with the word it opens — "(with" — so that is where
    // the check belongs, not on the word before it.
    return words
        .map((word, index) => formatWord(word, index === 0, word.startsWith('(')))
        .join(' ');
};

/**
 * What to show for an exercise. Catalogue names are capitalised; anything the
 * user wrote is returned untouched.
 */
export const exerciseDisplayName = (exercise: { name: string; userId?: string | null }): string =>
    isFitupExerciseUserId(exercise.userId) ? toTitleCase(exercise.name) : exercise.name;
