import { FC } from 'react';
import { StyleSheet } from 'react-native-unistyles';

import { Box } from '@/components/primitives/box';
import { SkeletonList } from '@/components/feedback/skeleton';

const styles = StyleSheet.create((theme, rt) => ({
    loadingContainer: {
        flex: 1,
        paddingHorizontal: theme.space(4),
        paddingTop: theme.space(2),
        paddingBottom: rt.insets.bottom,
    },
}));

const LoadingState: FC = () => (
    <Box style={styles.loadingContainer}>
        <SkeletonList count={4} lines={2} />
    </Box>
);

export { LoadingState };
