import { describe, expect, jest, test } from '@jest/globals';

/**
 * Guards the colour ramps.
 *
 * The semantic tokens are the platform's own colours now; the ramps remain
 * plain data that charts and accents read, and a ramp that stops running light
 * to dark breaks those quietly.
 */

jest.mock('react-native-unistyles', () => ({
    StyleSheet: { configure: () => undefined },
    UnistylesRuntime: { insets: { top: 0, bottom: 0 }, colorScheme: 'dark', isLandscape: false },
}));

jest.mock('@/storage', () => ({ storage: { getString: () => undefined } }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { colors } = require('../../unistyles');

const luminance = (hex: string): number => {
    const value = hex.replace('#', '');
    const [r, g, b] = [0, 2, 4].map((at) => parseInt(value.slice(at, at + 2), 16));

    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

describe('the colour ramps', () => {
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
});
