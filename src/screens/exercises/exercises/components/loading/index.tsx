import { FC } from 'react';
import { StyleSheet } from 'react-native-unistyles';

import { Box } from '@/components/primitives/box';
import { SkeletonList } from '@/components/feedback/skeleton';

const styles = StyleSheet.create((theme, rt) => ({
    loadingContainer: {
        flex: 1,
        paddingHorizontal: theme.space(4),
        paddingTop: theme.space(2),
        paddingBottom: rt.insets.bottom + theme.space(25),
    },
}));

const LoadingState: FC = () => (
    <Box style={styles.loadingContainer}>
        <SkeletonList count={6} lines={1} />
    </Box>
);

export { LoadingState };
