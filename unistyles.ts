import { storage } from '@/storage';
import { Appearance, Platform, PlatformColor, type ColorValue } from 'react-native';
import { requireNativeModule } from 'expo-modules-core';
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
    typography: {
        // The eyebrow label, declared once. It was being re-derived in 11
        // files with three different letter-spacings for the same element.
        eyebrow: {
            fontSize: FONT_SIZE_BASE * 0.625,
            lineHeight: FONT_SIZE_BASE * 1,
            letterSpacing: 1.2,
            textTransform: 'uppercase' as const,
            fontWeight: 600 as const,
        },
        // Any figure that changes in place — timers, weights, reps, volume —
        // so a running clock doesn't jitter and stat columns line up.
        metric: {
            fontVariant: ['tabular-nums' as const],
        },
    },
};

const func = {
    space: (v: number) => v * SPACE,
    /**
     * Breathing room only. Native headers and tab bars inset scroll content
     * themselves (`contentInsetAdjustmentBehavior` on iOS, layout on Android);
     * Android still draws edge to edge under the gesture bar on pushed screens.
     */
    screenContentPadding: (screen: 'root' | 'child' | 'editor' | 'sheet') => {
        const bottom = Platform.OS === 'android' ? UnistylesRuntime.insets.bottom : 0;

        if (screen === 'root') return { paddingTop: func.space(2), paddingBottom: func.space(8) };

        if (screen === 'editor')
            return { paddingTop: func.space(5), paddingBottom: bottom + func.space(24) };

        if (screen === 'sheet') return { paddingTop: func.space(5) };

        return { paddingTop: func.space(5), paddingBottom: bottom + func.space(5) };
    },
};

/**
 * FitSyn's palette, taken from the design's own stylesheet rather than sampled
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
     * land on real FitSyn colours: 50 and 950 are the two page grounds, 900 the
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

type Scheme = 'light' | 'dark';

type ExpoRouterNative = {
    Material3DynamicColor: (role: string, scheme: Scheme) => string | null;
};

/**
 * Material You roles resolved for one scheme. Android hands them back as plain
 * hex, so each theme gets its own set and JS consumers (charts, svg) can use
 * them as-is.
 *
 * ponytail: read once at launch, so a wallpaper change shows after a restart.
 */
const material = (role: string, scheme: Scheme): string =>
    requireNativeModule<ExpoRouterNative>('ExpoRouter').Material3DynamicColor(role, scheme) ??
    colors.neutral[500];

/**
 * The app's vocabulary (`foreground` is a card, `typography` is text) mapped onto
 * the OS's own colours: UIKit semantic colours on iOS, which follow the
 * appearance by themselves, and Material You on Android. The web default keeps
 * the old palette.
 */
const semantic = (scheme: Scheme): SemanticColors => {
    const dark = scheme === 'dark';

    if (Platform.OS === 'ios')
        return {
            background: PlatformColor('systemGroupedBackground'),
            foreground: PlatformColor('secondarySystemGroupedBackground'),
            elevated: PlatformColor('tertiarySystemGroupedBackground'),
            typography: PlatformColor('label'),
            mutedTypography: PlatformColor('secondaryLabel'),
            border: PlatformColor('separator'),
            input: PlatformColor('tertiarySystemFill'),
            primary: colors.brand[500],
            primaryTypography: colors.white,
            primarySoft: 'rgba(255, 69, 58, 0.16)',
            accent: PlatformColor('label'),
            accentTypography: PlatformColor('systemBackground'),
            success: PlatformColor('systemGreen'),
            destructive: PlatformColor('systemRed'),
        };

    if (Platform.OS === 'android')
        return {
            background: material('surface', scheme),
            foreground: material('surfaceContainer', scheme),
            elevated: material('surfaceContainerHigh', scheme),
            typography: material('onSurface', scheme),
            mutedTypography: material('onSurfaceVariant', scheme),
            border: material('outlineVariant', scheme),
            input: material('surfaceContainerHighest', scheme),
            primary: material('primary', scheme),
            primaryTypography: material('onPrimary', scheme),
            primarySoft: material('primaryContainer', scheme),
            accent: material('onSurface', scheme),
            accentTypography: material('surface', scheme),
            success: dark ? '#35c47f' : '#1f9d63',
            destructive: material('error', scheme),
        };

    return {
        background: dark ? colors.neutral[950] : colors.neutral[50],
        foreground: dark ? colors.neutral[900] : colors.white,
        elevated: dark ? colors.neutral[800] : colors.neutral[100],
        typography: dark ? colors.neutral[50] : colors.neutral[900],
        mutedTypography: dark ? colors.neutral[400] : colors.neutral[500],
        border: dark ? '#2c2c33' : colors.neutral[200],
        input: dark ? colors.neutral[700] : '#d5d5dd',
        primary: colors.brand[500],
        primaryTypography: colors.white,
        primarySoft: dark ? 'rgba(255, 69, 58, 0.16)' : colors.brand[100],
        accent: dark ? '#ff7a6e' : colors.neutral[900],
        accentTypography: dark ? colors.neutral[950] : colors.neutral[50],
        success: dark ? '#35c47f' : '#1f9d63',
        destructive: dark ? '#ff5a4e' : '#e0342a',
    };
};

/**
 * The same tokens as plain colour strings, for consumers that cannot take a
 * PlatformColor — chart and SVG libraries, gradients, Reanimated. On iOS these
 * are the published values of the UIKit colours above; Android's are already
 * strings.
 */
const IOS_SOLID: Record<Scheme, SolidColors> = {
    light: {
        background: '#f2f2f7',
        foreground: '#ffffff',
        elevated: '#ffffff',
        typography: '#000000',
        mutedTypography: 'rgba(60, 60, 67, 0.6)',
        border: 'rgba(60, 60, 67, 0.29)',
        input: 'rgba(118, 118, 128, 0.12)',
        primary: colors.brand[500],
        primaryTypography: colors.white,
        primarySoft: 'rgba(255, 69, 58, 0.16)',
        accent: '#000000',
        accentTypography: '#ffffff',
        success: '#34c759',
        destructive: '#ff3b30',
    },
    dark: {
        background: '#000000',
        foreground: '#1c1c1e',
        elevated: '#2c2c2e',
        typography: '#ffffff',
        mutedTypography: 'rgba(235, 235, 245, 0.6)',
        border: 'rgba(84, 84, 88, 0.65)',
        input: 'rgba(118, 118, 128, 0.24)',
        primary: colors.brand[500],
        primaryTypography: colors.white,
        primarySoft: 'rgba(255, 69, 58, 0.16)',
        accent: '#ffffff',
        accentTypography: '#000000',
        success: '#30d158',
        destructive: '#ff453a',
    },
};

const solid = (scheme: Scheme): SolidColors =>
    Platform.OS === 'ios' ? IOS_SOLID[scheme] : (semantic(scheme) as SolidColors);

type SolidColors = Record<keyof SemanticColors, string>;

type SemanticColors = Record<
    | 'background'
    | 'foreground'
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
    | 'destructive',
    ColorValue
>;

export const lightTheme = {
    colors: {
        ...semantic('light'),
        ...colors,
    },
    solid: solid('light'),
    ...common,
    ...func,
} as const;

export const darkTheme = {
    colors: {
        ...semantic('dark'),
        ...colors,
    },
    solid: solid('dark'),
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

// The in-app override is applied to the OS appearance itself, so native views
// and PlatformColors follow it along with the adaptive unistyles theme. No
// stored choice means Auto.
const storedTheme = storage.getString('user.theme');

if (storedTheme === 'light' || storedTheme === 'dark') {
    Appearance.setColorScheme(storedTheme);
}

StyleSheet.configure({
    settings: {
        adaptiveThemes: true,
    },
    themes: {
        light: lightTheme,
        dark: darkTheme,
    },
    breakpoints,
});
