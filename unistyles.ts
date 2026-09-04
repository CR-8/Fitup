import { storage } from '@/storage';
import { Platform } from 'react-native';
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
        '4xl': 32,
        full: 9999,
    },
    fontSize: {
        '2xs': {
            fontSize: FONT_SIZE_BASE * 0.625,
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
};

const func = {
    space: (v: number) => v * SPACE,
    statusBarHeight: () => {
        const hasDynamicIsland = Platform.OS === 'ios' && UnistylesRuntime.insets.top > 50;
        return hasDynamicIsland ? UnistylesRuntime.insets.top - 6 : UnistylesRuntime.insets.top;
    },
    headerHeight: (modalPresentation: boolean = false) => {
        let headerHeight;

        if (Platform.OS === 'ios') {
            if (Platform.isPad || Platform.isTV) {
                if (modalPresentation) {
                    headerHeight = 56;
                } else {
                    headerHeight = 50;
                }
            } else {
                if (UnistylesRuntime.isLandscape) {
                    headerHeight = 32;
                } else {
                    if (modalPresentation) {
                        headerHeight = 56;
                    } else {
                        headerHeight = 56;
                    }
                }
            }
        } else if (Platform.OS === 'android') {
            headerHeight = 64;
        } else {
            headerHeight = 64;
        }

        return headerHeight;
    },
    screenHeaderHeight: (modalPresentation: boolean = false) => {
        let headerHeight = func.headerHeight(modalPresentation);
        const statusBarHeight = func.statusBarHeight();

        return headerHeight + statusBarHeight;
    },
    headerContentTopOffset: (contentHeight: number, modalPresentation: boolean = false): number => {
        const statusBarHeight = func.statusBarHeight();
        const navHeaderBodyHeight = func.headerHeight(modalPresentation);
        const centeredOffset = Math.max(0, (navHeaderBodyHeight - contentHeight) / 2);

        return statusBarHeight + centeredOffset;
    },
    sheetHeaderHeight: () => {
        return func.screenHeaderHeight() - func.space(5);
    },
    screenContentPadding: (screen: 'root' | 'child' | 'editor' | 'sheet') => {
        if (screen === 'root')
            return {
                paddingTop: func.screenHeaderHeight(),
                paddingBottom: UnistylesRuntime.insets.bottom + func.space(20),
            };

        if (screen === 'editor')
            return {
                paddingTop: func.screenHeaderHeight() + func.space(5),
                paddingBottom: UnistylesRuntime.insets.bottom + func.space(24),
            };

        if (screen === 'sheet')
            return {
                paddingTop: func.sheetHeaderHeight(),
            };

        return {
            paddingTop: func.screenHeaderHeight() + func.space(5),
            paddingBottom: UnistylesRuntime.insets.bottom + func.space(5),
        };
    },
};

/**
 * FitSync's palette, taken from the design's own stylesheet rather than sampled
 * by eye.
 *
 * The ramps matter as much as the semantic tokens below them: around 150 places
 * in the app reach for `neutral[n]` or `brand[n]` directly, and re-deriving the
 * ramps is what moves those with everything else instead of leaving Tailwind
 * greys and cyan scattered through the screens.
 */
export const colors = {
    white: '#FFFFFF',
    black: '#000000',

    /**
     * Rebuilt around the design's surfaces, so the steps the app already uses
     * land on real FitSync colours: 50 and 950 are the two page grounds, 900 the
     * dark card, 200 the light border, 400 and 500 the muted text.
     */
    neutral: {
        50: '#f4f4f6',
        100: '#ebebef',
        200: '#e0e0e6',
        300: '#c9c9d2',
        400: '#8e8ea0',
        500: '#6c6c78',
        600: '#55555f',
        700: '#34343c',
        800: '#292930',
        900: '#1e1e22',
        925: '#141417',
        950: '#0b0b0c',
    },

    /**
     * The brand ramp keeps its name and shape and changes hue — it was cyan.
     * Every place already reaching for `brand` becomes the coral accent without
     * being touched.
     */
    brand: {
        50: '#fff1ef',
        100: '#ffe7e4',
        200: '#ffcdc7',
        300: '#ffa99f',
        400: '#ff8a7f',
        500: '#ff453a',
        600: '#e0342a',
        700: '#c02a21',
        800: '#8f1f19',
        900: '#5e1410',
        950: '#2f0a08',
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

/**
 * Naming follows the app's existing vocabulary rather than the stylesheet's.
 *
 * Here `foreground` already means the raised surface a card is drawn on and
 * `typography` means text, so the design's `--card` and `--foreground` map onto
 * those. Importing the CSS names would have left two different meanings of
 * "foreground" in one file.
 */
export const lightTheme = {
    colors: {
        background: colors.neutral[50],
        foreground: colors.white,
        elevated: colors.neutral[100],
        typography: colors.neutral[900],
        mutedTypography: colors.neutral[500],
        border: colors.neutral[200],
        input: '#d5d5dd',
        primary: colors.brand[500],
        primaryTypography: colors.white,
        primarySoft: colors.brand[100],
        accent: colors.neutral[900],
        accentTypography: colors.neutral[50],
        success: '#1f9d63',
        destructive: '#e0342a',
        ...colors,
    },
    gradients: {
        brand: ['#ff6a55', '#ff2d20'],
        ink: ['#1e1e22', '#3a3a44'],
        surface: ['#ffffff', '#f7f7f9'],
        /** Stands in for the design's radial bloom; see `glow` in the theme. */
        glow: ['rgba(255, 69, 58, 0.14)', 'rgba(255, 69, 58, 0)'],
    },
    shadows: {
        soft: {
            shadowColor: '#1e1e22',
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: 0.14,
            shadowRadius: 18,
            elevation: 4,
        },
        lift: {
            shadowColor: '#1e1e22',
            shadowOffset: { width: 0, height: 18 },
            shadowOpacity: 0.18,
            shadowRadius: 24,
            elevation: 10,
        },
        glow: {
            shadowColor: colors.brand[500],
            shadowOffset: { width: 0, height: 14 },
            shadowOpacity: 0.45,
            shadowRadius: 20,
            elevation: 10,
        },
    },
    ...common,
    ...func,
} as const;

export const darkTheme = {
    colors: {
        background: colors.neutral[950],
        foreground: colors.neutral[900],
        elevated: colors.neutral[800],
        typography: colors.neutral[50],
        mutedTypography: colors.neutral[400],
        border: '#2c2c33',
        input: colors.neutral[700],
        primary: colors.brand[500],
        primaryTypography: colors.white,
        // The design tints this one rather than using a solid, so the card
        // beneath shows through a pill.
        primarySoft: 'rgba(255, 69, 58, 0.16)',
        accent: '#ff7a6e',
        accentTypography: colors.neutral[950],
        success: '#35c47f',
        destructive: '#ff5a4e',
        ...colors,
    },
    gradients: {
        brand: ['#ff6a55', '#e0342a'],
        ink: ['#1e1e22', '#0b0b0c'],
        surface: ['#1e1e22', '#17171a'],
        glow: ['rgba(255, 69, 58, 0.20)', 'rgba(255, 69, 58, 0)'],
    },
    shadows: {
        soft: {
            shadowColor: colors.black,
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: 0.5,
            shadowRadius: 18,
            elevation: 4,
        },
        lift: {
            shadowColor: colors.black,
            shadowOffset: { width: 0, height: 18 },
            shadowOpacity: 0.65,
            shadowRadius: 24,
            elevation: 10,
        },
        glow: {
            shadowColor: colors.brand[500],
            shadowOffset: { width: 0, height: 14 },
            shadowOpacity: 0.55,
            shadowRadius: 20,
            elevation: 10,
        },
    },
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

StyleSheet.configure({
    settings: {
        adaptiveThemes: false,
        initialTheme: () => {
            const theme = storage.getString('user.theme');

            if (!theme) {
                return 'dark';
            }

            if (theme === 'auto') {
                return UnistylesRuntime.colorScheme === 'dark' ? 'dark' : 'light';
            }

            return theme as keyof typeof appThemes;
        },
    },
    themes: {
        light: lightTheme,
        dark: darkTheme,
    },
    breakpoints,
});
