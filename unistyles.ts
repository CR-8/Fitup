import { Appearance, Platform, type ColorValue } from 'react-native';
import { StyleSheet, UnistylesRuntime } from 'react-native-unistyles';

const FONT_SIZE_BASE = 16;
const SPACE = 4;

const common = {
    radius: {
        none: 0,
        xs: 2,
        sm: 4,
        md: 6,
        lg: 8,
        xl: 12,
        '2xl': 16,
        '3xl': 24,
        // Was 32. The app's best-built surfaces (up-next, timer, stat-blocks)
        // already ship at 24 — this collapses the 32/24/16 three-way split
        // that had crept into the other ~34 files onto that same value.
        '4xl': 24,
        full: 9999,
    },
    fontSize: {
        // Nothing in the app is set under 12pt, so the two smallest steps share it.
        '2xs': {
            fontSize: FONT_SIZE_BASE * 0.75,
            lineHeight: FONT_SIZE_BASE * 1,
        },
        xs: {
            fontSize: FONT_SIZE_BASE * 0.75,
            lineHeight: FONT_SIZE_BASE * 1,
        },
        sm: {
            fontSize: FONT_SIZE_BASE * 0.875,
            lineHeight: FONT_SIZE_BASE * 1.25,
        },
        default: {
            fontSize: FONT_SIZE_BASE,
            lineHeight: FONT_SIZE_BASE * 1.5,
        },
        lg: {
            fontSize: FONT_SIZE_BASE * 1.125,
            lineHeight: FONT_SIZE_BASE * 1.5,
        },
        xl: {
            fontSize: FONT_SIZE_BASE * 1.25,
            lineHeight: FONT_SIZE_BASE * 1.5,
        },
        '2xl': {
            fontSize: FONT_SIZE_BASE * 1.375,
            lineHeight: FONT_SIZE_BASE * 1.75,
        },
        '3xl': {
            fontSize: FONT_SIZE_BASE * 1.75,
            lineHeight: FONT_SIZE_BASE * 2.125,
        },
        '4xl': {
            fontSize: FONT_SIZE_BASE * 2.125,
            lineHeight: FONT_SIZE_BASE * 2.55,
        },
    },
    fontWeight: {
        default: {
            fontWeight: 400,
        },
        medium: {
            fontWeight: 500,
        },
        semibold: {
            fontWeight: 600,
        },
        bold: {
            fontWeight: 700,
        },
        extrabold: {
            fontWeight: 800,
        },
        black: {
            fontWeight: 900,
        },
    } as const,
    typography: {
        // The eyebrow label, declared once. Sentence case at 12/16 with no
        // tracking: nothing in the app is set smaller than 12pt.
        eyebrow: {
            fontSize: 12,
            lineHeight: 16,
            fontWeight: 600 as const,
        },
        // Any figure that changes in place (timers, weights, reps, volume), in
        // the Summary's numerals: SF Rounded on iOS, as Apple Fitness sets its
        // figures, and Space Grotesk on Android (bundled, see theme/fonts).
        // Tabular, so a running clock does not jitter and columns line up.
        metric: {
            fontFamily: Platform.OS === 'ios' ? 'ui-rounded' : 'SpaceGrotesk_600SemiBold',
            fontWeight: 600 as const,
            fontVariant: ['tabular-nums' as const],
        },
    },
};

/** Android's hand-built header: the status bar plus a 64pt bar. */
const ANDROID_HEADER_HEIGHT = 64;

const func = {
    space: (v: number) => v * SPACE,
    /*
     * Android keeps the pre-native UI, whose headers are drawn by the app and
     * float over the content; these place things around them. iOS uses native
     * bars, which inset their content themselves.
     */
    statusBarHeight: () => UnistylesRuntime.insets.top,
    headerHeight: (_modalPresentation: boolean = false) => ANDROID_HEADER_HEIGHT,
    screenHeaderHeight: (modalPresentation: boolean = false) =>
        func.headerHeight(modalPresentation) + func.statusBarHeight(),
    headerContentTopOffset: (contentHeight: number, modalPresentation: boolean = false): number =>
        func.statusBarHeight() +
        Math.max(0, (func.headerHeight(modalPresentation) - contentHeight) / 2),
    sheetHeaderHeight: () => func.screenHeaderHeight() - func.space(5),
    screenContentPadding: (screen: 'root' | 'child' | 'editor' | 'sheet') => {
        const bottom = UnistylesRuntime.insets.bottom;

        if (Platform.OS === 'android') {
            const top = func.screenHeaderHeight();

            if (screen === 'root')
                return { paddingTop: top, paddingBottom: bottom + func.space(20) };
            if (screen === 'editor')
                return { paddingTop: top + func.space(5), paddingBottom: bottom + func.space(24) };
            if (screen === 'sheet') return { paddingTop: func.sheetHeaderHeight() };

            return { paddingTop: top + func.space(5), paddingBottom: bottom + func.space(5) };
        }

        // Breathing room only: native headers and tab bars inset scroll content
        // themselves (`contentInsetAdjustmentBehavior`).
        if (screen === 'root') return { paddingTop: func.space(2), paddingBottom: func.space(8) };
        if (screen === 'editor')
            return { paddingTop: func.space(5), paddingBottom: func.space(24) };
        if (screen === 'sheet') return { paddingTop: func.space(5) };

        return { paddingTop: func.space(5), paddingBottom: func.space(5) };
    },
};

/**
 * FitSyn's palette, from the approved v2 design.
 *
 * Around 150 places reach for `neutral[n]` or `brand[n]` directly, so the ramps
 * are rebuilt rather than the call sites: 950 is the dark page, 900 the card,
 * 800 raised surfaces and inputs, 700 the line; 400 is the secondary text
 * (7.3:1 on the card) and 50 the light page.
 */
export const colors = {
    white: '#FFFFFF',
    black: '#000000',

    // The redesign brief's surfaces: #08090B page, #14161A card, #1B1E23
    // raised, #9A9FA8 secondary text, #F5F6F7 primary text.
    neutral: {
        50: '#f5f6f7',
        100: '#eceef1',
        200: '#dfe1e6',
        300: '#c6c9cf',
        400: '#9a9fa8',
        500: '#6f747d',
        600: '#4b5059',
        700: '#262a31',
        800: '#1b1e23',
        900: '#14161a',
        925: '#0e1013',
        950: '#08090b',
    },

    /**
     * 500 is the brand: logo, selected states, rings, checks, the active tab.
     * 600 is the filled primary button's ground, because white on 500 is only
     * 3.9:1 and on 600 it is 4.8:1.
     */
    brand: {
        50: '#fff1f3',
        100: '#ffe0e4',
        200: '#ffc2ca',
        300: '#ff96a2',
        400: '#ff6676',
        500: '#ff3b4f',
        600: '#e0263b',
        700: '#b81a2d',
        800: '#8a1221',
        900: '#5c0c16',
        950: '#2e050b',
    },

    /** Tiny dots and tags in Plan and Progress only. */
    training: {
        push: '#e5383b',
        pull: '#2f6fed',
        legs: '#f2c230',
        core: '#2fbf71',
        mobility: '#dadad5',
    },

    /**
     * Left as it was. In an app accented in coral a destructive red is never
     * going to be strikingly different, and these are used on filled warning
     * cards where the context carries the meaning; re-tinting them would add
     * churn across 30-odd call sites to no real end.
     */
    red: {
        50: '#fef2f2',
        100: '#fee2e2',
        200: '#fecaca',
        300: '#fca5a5',
        400: '#f87171',
        500: '#ef4444',
        600: '#dc2626',
        700: '#b91c1c',
        800: '#991b1b',
        900: '#7f1d1d',
        950: '#450a0a',
    },
    amber: {
        50: '#fffbeb',
        100: '#fef3c7',
        200: '#fde68a',
        300: '#fcd34d',
        400: '#fbbf24',
        500: '#f59e0b',
        600: '#d97706',
        700: '#b45309',
        800: '#92400e',
        900: '#78350f',
        950: '#451a03',
    },
};

type Scheme = 'light' | 'dark';

/**
 * The app's vocabulary (`foreground` is a card, `typography` is text), as one
 * palette for both platforms: the approved design draws its own surfaces rather
 * than the system's. Native controls and bars still follow the OS appearance,
 * which `Appearance.setColorScheme` below keeps in step with the chosen theme.
 */
const semantic = (scheme: Scheme): SemanticColors => {
    const dark = scheme === 'dark';
    const ios = Platform.OS === 'ios';

    return {
        background: dark ? colors.neutral[950] : colors.neutral[50],
        // The Summary redesign's card (#1B1E23) on the near-black page, as
        // Apple Fitness sets #1C1C1E on black. Every screen's cards use it.
        foreground: dark ? colors.neutral[800] : colors.white,
        // A section set into the page: a raised card on iOS, flush on Android,
        // as the pre-native design drew it.
        inset: ios
            ? dark
                ? colors.neutral[800]
                : colors.white
            : dark
              ? colors.neutral[950]
              : colors.neutral[50],
        // Raised on a card or a sheet (a chip, a stepper button, a grouped row
        // in a sheet), one step lighter than the card, as Apple's #2C2C2E.
        elevated: dark ? colors.neutral[700] : colors.neutral[100],
        typography: dark ? colors.neutral[50] : colors.neutral[950],
        mutedTypography: dark ? colors.neutral[400] : colors.neutral[600],
        // A hairline you notice only when you look for it, as the brief asks.
        border: dark ? '#23262c' : colors.neutral[200],
        input: dark ? colors.neutral[700] : colors.neutral[100],
        primary: colors.brand[500],
        primaryTypography: colors.white,
        primarySoft: dark ? 'rgba(255, 59, 79, 0.16)' : colors.brand[100],
        accent: dark ? colors.brand[400] : colors.neutral[950],
        accentTypography: dark ? colors.neutral[950] : colors.neutral[50],
        success: colors.training.core,
        destructive: dark ? colors.brand[400] : colors.brand[600],
        // Water only. Blue so it never reads as the brand red or as a training
        // ring; text-safe on the card in both schemes.
        hydration: dark ? '#4aa8ff' : '#1d6fd6',
        hydrationSoft: dark ? 'rgba(74, 168, 255, 0.18)' : '#e3f0ff',
    };
};

/** Plain colour strings, for chart and SVG libraries, gradients and Reanimated. */
const solid = (scheme: Scheme): SolidColors => semantic(scheme) as SolidColors;

type SolidColors = Record<keyof SemanticColors, string>;

type SemanticColors = Record<
    | 'background'
    | 'foreground'
    /**
     * A section set into the page: a raised card on iOS (inset grouped), flush
     * with the page on Android, as the pre-native design drew it.
     */
    | 'inset'
    | 'elevated'
    | 'typography'
    | 'mutedTypography'
    | 'border'
    | 'input'
    | 'primary'
    | 'primaryTypography'
    | 'primarySoft'
    | 'accent'
    | 'accentTypography'
    | 'success'
    | 'destructive'
    | 'hydration'
    | 'hydrationSoft',
    ColorValue
>;

/** Android's pre-native surfaces paint with these; iOS draws flat system surfaces. */
const GRADIENTS = {
    light: {
        brand: ['#ff5d69', '#fa2736'],
        ink: ['#16181c', '#2a2d33'],
        surface: ['#ffffff', '#f5f6f8'],
        /** Stands in for the design's radial bloom; see `glow` in the theme. */
        glow: ['rgba(250, 39, 54, 0.14)', 'rgba(250, 39, 54, 0)'],
    },
    dark: {
        brand: ['#ff6676', '#e0263b'],
        ink: ['#14161a', '#08090b'],
        surface: ['#1b1e23', '#14161a'],
        glow: ['rgba(255, 59, 79, 0.20)', 'rgba(255, 59, 79, 0)'],
    },
} as const;

const shadows = (ink: string, soft: number, lift: number, glow: number) => ({
    soft: {
        shadowColor: ink,
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: soft,
        shadowRadius: 18,
        elevation: 4,
    },
    lift: {
        shadowColor: ink,
        shadowOffset: { width: 0, height: 18 },
        shadowOpacity: lift,
        shadowRadius: 24,
        elevation: 10,
    },
    glow: {
        shadowColor: colors.brand[500],
        shadowOffset: { width: 0, height: 14 },
        shadowOpacity: glow,
        shadowRadius: 20,
        elevation: 10,
    },
});

export const lightTheme = {
    colors: {
        ...semantic('light'),
        ...colors,
    },
    solid: solid('light'),
    gradients: GRADIENTS.light,
    shadows: shadows('#16181c', 0.14, 0.18, 0.45),
    ...common,
    ...func,
} as const;

export const darkTheme = {
    colors: {
        ...semantic('dark'),
        ...colors,
    },
    solid: solid('dark'),
    gradients: GRADIENTS.dark,
    shadows: shadows(colors.black, 0.5, 0.65, 0.55),
    ...common,
    ...func,
} as const;

const appThemes = {
    light: lightTheme,
    dark: darkTheme,
};

const breakpoints = {
    xs: 0,
    sm: 300,
    md: 500,
    lg: 800,
    xl: 1200,
};

type AppBreakpoints = typeof breakpoints;
type AppThemes = typeof appThemes;

declare module 'react-native-unistyles' {
    export interface UnistylesThemes extends AppThemes {}
    export interface UnistylesBreakpoints extends AppBreakpoints {}
}

// The redesign is dark only, as the reference is. The light theme stays
// defined (and a stored choice stays stored) so it can come back, but neither
// is applied: `applyTheme` in `use-user` pins dark as well.

// Native bars, menus and controls follow the OS appearance, so it is pinned too.
Appearance.setColorScheme?.('dark');

StyleSheet.configure({
    settings: { initialTheme: 'dark' },
    themes: {
        light: lightTheme,
        dark: darkTheme,
    },
    breakpoints,
});
