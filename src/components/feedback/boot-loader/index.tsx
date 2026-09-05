import { FC } from 'react';
import { ActivityIndicator } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Box } from '@/components/primitives/box';

const styles = StyleSheet.create((theme) => ({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.background,
    },
}));

/**
 * Shown while migrations, fonts and the local user are being prepared.
 *
 * This replaces the branded splash screen: the app opens straight onto its own
 * background with a plain spinner, so there is no image to keep in step with the
 * brand and no jump between a native splash and the first screen.
 */
export const BootLoader: FC = () => {
    const { theme } = useUnistyles();

    return (
        <Box style={styles.container}>
            <ActivityIndicator size="large" color={theme.colors.brand[500]} />
        </Box>
    );
};
