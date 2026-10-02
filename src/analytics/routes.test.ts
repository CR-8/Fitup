import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, test } from '@jest/globals';

const routesDirectory = join(process.cwd(), 'src/routes');

const getLeafRoutes = (directory: string): string[] =>
    readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = join(directory, entry.name);

        if (entry.isDirectory()) return getLeafRoutes(path);
        // Layouts, including platform ones (`_layout.android.tsx`), are not screens.
        if (!entry.name.endsWith('.tsx') || /^_layout(\.\w+)?\.tsx$/.test(entry.name)) return [];

        return [path];
    });

describe('analytics route coverage', () => {
    test.each(
        getLeafRoutes(routesDirectory).map((route) => [relative(process.cwd(), route), route]),
    )('%s declares its analytics screen', (_routeName, route) => {
        const source = readFileSync(route, 'utf8');

        expect(source).toContain('useAnalyticsScreen(');
    });

    test('screen tracking does not infer names from route paths', () => {
        const tracker = readFileSync(join(process.cwd(), 'src/analytics/tracker.tsx'), 'utf8');
        const helpers = readFileSync(join(process.cwd(), 'src/analytics/helpers.ts'), 'utf8');

        expect(tracker).not.toContain('usePathname');
        expect(helpers).not.toContain('getAnalyticsScreen');
        expect(helpers).not.toContain('normalizeAnalyticsRoute');
    });
});
