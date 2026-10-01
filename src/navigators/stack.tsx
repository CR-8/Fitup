import type { ComponentProps, FC } from 'react';
import { Stack } from 'expo-router';

import { useScreen } from '@/hooks/use-screen';

export { Stack };

export type ScreenOptions = Exclude<
    NonNullable<ComponentProps<typeof Stack.Screen>['options']>,
    (...args: never[]) => unknown
>;

/**
 * The one-screen stack every tab sits in. Native tabs draw no header of their
 * own, so this is what gives each tab its large title and header buttons.
 */
export const TabStack: FC<{ name: string; options: ScreenOptions }> = ({ name, options }) => {
    const { options: base } = useScreen();

    return (
        <Stack screenOptions={base}>
            <Stack.Screen name={name} options={{ headerLargeTitle: true, ...options }} />
        </Stack>
    );
};
