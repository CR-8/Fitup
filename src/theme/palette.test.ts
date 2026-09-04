import { describe, expect, jest, test } from '@jest/globals';

/**
 * Guards the FitSync palette.
 *
 * `unistyles.ts` configures the native runtime on import and reads the stored
 * theme from MMKV, neither of which exists here — but the tokens themselves are
 * plain data and are the thing worth holding still. A colour that goes missing
 * from one theme only, or a ramp that stops running dark to light, breaks
 * screens quietly and in the theme most people never look at.
 */

jest.mock('react-native-unistyles', () => ({
    StyleSheet: { configure: () => undefined },
    UnistylesRuntime: { insets: { top: 0, bottom: 0 }, colorScheme: 'dark', isLandscape: false },
}));

jest.mock('@/storage', () => ({ storage: { getString: () => undefined } }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { colors, lightTheme, darkTheme } = require('../../unistyles');

const luminance = (hex: string): number => {
    const value = hex.replace('#', '');
    const [r, g, b] = [0, 2, 4].map((at) => parseInt(value.slice(at, at + 2), 16));

    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** Everything a screen can ask a theme for. */
const SEMANTIC_TOKENS = [
    'background',
    'foreground',
    'elevated',
    'typography',
    'mutedTypography',
    'border',
    'input',
    'primary',
    'primaryTypography',
    'primarySoft',
    'accent',
    'accentTypography',
    'success',
    'destructive',
] as const;

describe('the palette', () => {
    test.each(SEMANTIC_TOKENS)('%s is defined in both themes', (token) => {
        expect(lightTheme.colors[token]).toBeTruthy();
        expect(darkTheme.colors[token]).toBeTruthy();
    });

    test('the neutral ramp runs light to dark without turning back', () => {
        const steps = Object.keys(colors.neutral)
            .map(Number)
            .sort((a, b) => a - b)
            .map((step) => luminance(colors.neutral[step]));

        for (let at = 1; at < steps.length; at += 1) {
            expect(steps[at]).toBeLessThan(steps[at - 1]);
        }
    });

    test('the brand ramp runs light to dark without turning back', () => {
        const steps = Object.keys(colors.brand)
            .map(Number)
            .sort((a, b) => a - b)
            .map((step) => luminance(colors.brand[step]));

        for (let at = 1; at < steps.length; at += 1) {
            expect(steps[at]).toBeLessThan(steps[at - 1]);
        }
    });

    // The brand was cyan before FitSync, and 54 places reach for it by name.
    test('no cyan survives anywhere in either theme', () => {
        const cyan = ['#06b6d4', '#22d3ee', '#0891b2', '#67e8f9', '#cffafe'];
        const everything = JSON.stringify([lightTheme.colors, darkTheme.colors]).toLowerCase();

        for (const shade of cyan) {
            expect(everything).not.toContain(shade);
        }
    });

    test('the accent is the same coral in both themes', () => {
        expect(lightTheme.colors.primary).toBe('#ff453a');
        expect(darkTheme.colors.primary).toBe('#ff453a');
    });

    test('cards sit above the page in both themes', () => {
        // White cards on a grey page, and lighter cards on a near-black one. It
        // reads as a step up either way, which is the opposite of what the app
        // did before: light mode used to put a grey card on a white page.
        expect(luminance(darkTheme.colors.foreground)).toBeGreaterThan(
            luminance(darkTheme.colors.background),
        );
        expect(luminance(lightTheme.colors.foreground)).toBeGreaterThan(
            luminance(lightTheme.colors.background),
        );
    });

    test('text carries against its own page', () => {
        expect(luminance(darkTheme.colors.typography)).toBeGreaterThan(
            luminance(darkTheme.colors.background) + 100,
        );
        expect(luminance(lightTheme.colors.typography)).toBeLessThan(
            luminance(lightTheme.colors.background) - 100,
        );
    });

    test('muted text is quieter than body text but still legible', () => {
        for (const theme of [lightTheme, darkTheme]) {
            const body = luminance(theme.colors.typography);
            const muted = luminance(theme.colors.mutedTypography);
            const page = luminance(theme.colors.background);

            expect(Math.abs(muted - page)).toBeLessThan(Math.abs(body - page));
            expect(Math.abs(muted - page)).toBeGreaterThan(40);
        }
    });

    test('every theme carries the gradients and shadows the design leans on', () => {
        for (const theme of [lightTheme, darkTheme]) {
            expect(theme.gradients.brand).toHaveLength(2);
            expect(theme.gradients.ink).toHaveLength(2);
            expect(theme.gradients.glow).toHaveLength(2);
            expect(theme.shadows.glow.shadowColor).toBe('#ff453a');
            expect(theme.shadows.lift.shadowRadius).toBeGreaterThan(0);
        }
    });
});
