export const Locale = {
    EN: 'en',
    HI: 'hi',
};

export const localeNames = {
    [Locale.EN]: 'English',
    [Locale.HI]: 'हिन्दी',
};

export const defaultLocale = Locale.EN;

export const supportedLanguages = [Locale.EN, Locale.HI];

/**
 * The language to actually use for a stored value.
 *
 * The app shipped Spanish, Russian and Chinese before it shipped two languages,
 * so a device that has been here a while may still have one of them saved
 * against its user row. i18next already falls back for rendering, but the value
 * is also validated on write — `editUserSchema` enums it — so an unsupported
 * language left in place would fail the save of any *other* setting, on a field
 * nobody touched.
 */
export const normalizeLanguage = (language: string | null | undefined): string => {
    const base = (language ?? '').split('-')[0].toLowerCase();

    return supportedLanguages.includes(base) ? base : defaultLocale;
};
