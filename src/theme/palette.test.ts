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

/**
 * WCAG contrast, which is not what `luminance` above computes — that one is a
 * perceived-brightness ordering for the ramps, on 0-255. This linearises sRGB
 * first, so the numbers can be compared against the 4.5:1 threshold.
 */
const contrastRatio = (a: string, b: string): number => {
    const relative = (hex: string): number => {
        const value = hex.replace('#', '');
        const channels = [0, 2, 4]
            .map((at) => parseInt(value.slice(at, at + 2), 16) / 255)
            .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));

        return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
    };

    const [lighter, darker] = [relative(a), relative(b)].sort((x, y) => y - x);

    return (lighter + 0.05) / (darker + 0.05);
};

/**
 * Home's up-next pill is the app's most prominent call to action, and it was
 * shipped as white on `brand[500]` — 3.41:1, which is neither AA for body text
 * nor large enough to claim the 3:1 allowance. These two pairs are what it uses
 * instead, so a future edit to the brand ramp cannot quietly wash it out again.
 */
describe('the up-next pill stays readable', () => {
    test('white on the filled pill clears AA', () => {
        expect(contrastRatio(colors.white, colors.brand[600])).toBeGreaterThanOrEqual(4.4);
    });

    test('the coral label on the inverted pill clears AA', () => {
        expect(contrastRatio(colors.brand[700], colors.white)).toBeGreaterThanOrEqual(4.5);
    });

    test('the shade it replaced would not have', () => {
        expect(contrastRatio(colors.white, colors.brand[500])).toBeLessThan(4.5);
    });
});

/**
 * The field error state, which shipped painting its text in the same token as
 * its own background — `red[100]` on `red[100]`, 1.00:1. The field looked empty
 * while holding what had been typed into it, so it read as the app losing the
 * input rather than as an error.
 *
 * `red[500]` is what every other field uses and would have been the obvious
 * repair, but those sit on the ordinary surface; on this pink it is 3.08:1.
 */
describe('a field in its error state stays readable', () => {
    test('the error text is not the error background', () => {
        expect(colors.red[700]).not.toBe(colors.red[100]);
    });

    test('the error text clears AA on the error background', () => {
        expect(contrastRatio(colors.red[700], colors.red[100])).toBeGreaterThanOrEqual(4.5);
    });

    test('the shade the other fields use would not have', () => {
        expect(contrastRatio(colors.red[500], colors.red[100])).toBeLessThan(4.5);
    });
});

/**
 * A filled button inverts: near-black in light mode, white in dark. Its label
 * has to invert with it, and the two empty-state buttons went out labelled
 * `typography` instead — the colour of the page, which is the colour the button
 * is painted. 1.10:1 in dark and 1.18:1 in light, so the button looked blank in
 * both.
 *
 * `Button` gets this right for a string title; the screens had passed a node,
 * which opts out of its styling entirely.
 */
describe('a filled button label stays readable', () => {
    test('the dark-mode pairing clears AA', () => {
        expect(contrastRatio(colors.neutral[950], colors.white)).toBeGreaterThanOrEqual(4.5);
    });

    test('the light-mode pairing clears AA', () => {
        expect(contrastRatio(colors.neutral[50], colors.neutral[950])).toBeGreaterThanOrEqual(4.5);
    });

    test('labelling it with the page text colour would not have', () => {
        expect(contrastRatio(darkTheme.colors.typography, colors.white)).toBeLessThan(4.5);
        expect(contrastRatio(lightTheme.colors.typography, colors.neutral[950])).toBeLessThan(4.5);
    });
});
