/**
 * Equipment naming.
 *
 * The catalogue's equipment values come from the open exercise dataset as
 * display-ish English with spaces — `body weight`, `ez barbell`, `leverage
 * machine`. They were never translated, so they reached the screen exactly as
 * the dataset wrote them, in every language.
 *
 * Rather than rewrite 1,324 rows, the value is folded into a translation key at
 * read time. That keeps the stored data faithful to its source and leaves the
 * naming decision where the other naming decisions live, in the locale files.
 */

/** `"ez barbell"` → `"ez_barbell"`, the key under `common:equipment`. */
export const equipmentTranslationKey = (value: string): string =>
    value.trim().toLowerCase().replace(/\s+/g, '_');
