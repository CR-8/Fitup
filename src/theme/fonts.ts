import i18n from '@/locale/i18n';

/**
 * FitSync's two typefaces, and the one thing that stops them breaking the app.
 *
 * Space Grotesk carries headings and figures; DM Sans carries everything else.
 * Both are Latin-only — DM Sans ships latin and latin-ext, Space Grotesk adds
 * Vietnamese — and neither has a single Devanagari glyph. The app ships Hindi,
 * so applying these globally would turn half the app's languages into rows of
 * empty boxes.
 *
 * So they are applied by language. English gets the design; Hindi keeps the
 * system font, which is exactly what every language rendered in before this —
 * there was no `fontFamily` anywhere in the app, and the six bundled Inter files
 * were never referenced by anything.
 *
 * The residual gap is a user typing non-Latin text into an English UI. Their
 * workout name would fall back to whatever the platform substitutes. Narrow
 * enough to accept, wide enough to write down.
 */

/** Keys must match the names registered with `useFonts` in the root layout. */
export const FONT_FAMILIES = {
    body: {
        400: 'DMSans_400Regular',
        500: 'DMSans_500Medium',
        600: 'DMSans_600SemiBold',
        700: 'DMSans_700Bold',
    },
    display: {
        500: 'SpaceGrotesk_500Medium',
        600: 'SpaceGrotesk_600SemiBold',
        700: 'SpaceGrotesk_700Bold',
    },
} as const;

/** The scripts the two faces actually contain. */
const LATIN_LANGUAGES = new Set(['en']);

export const usesBrandTypefaces = (language: string = i18n.language): boolean =>
    LATIN_LANGUAGES.has((language ?? '').split('-')[0]);

const nearestWeight = (weight: number, available: number[]): number =>
    available.reduce((best, candidate) =>
        Math.abs(candidate - weight) < Math.abs(best - weight) ? candidate : best,
    );

/**
 * Neither face goes past 700, but the app's scale reaches 800 and 900 — `Title`
 * asks for extrabold. Rather than let the platform synthesise a heavier cut,
 * which it does by smearing the outlines, those fall back to the boldest real
 * weight the family has.
 */
const resolve = (families: Record<number, string>, weight: number | undefined): string => {
    const available = Object.keys(families).map(Number);

    return families[nearestWeight(weight ?? 400, available)];
};

export const bodyFontFamily = (weight?: number): string | undefined =>
    usesBrandTypefaces() ? resolve(FONT_FAMILIES.body, weight) : undefined;

export const displayFontFamily = (weight?: number): string | undefined =>
    usesBrandTypefaces() ? resolve(FONT_FAMILIES.display, weight) : undefined;
