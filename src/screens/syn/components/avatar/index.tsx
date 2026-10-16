import { FC } from 'react';
import { StyleSheet } from 'react-native-unistyles';

import { Box } from '@/components/primitives/box';
import { SynMark } from '@/components/brand/syn-mark';

const styles = StyleSheet.create((theme) => ({
    avatar: {
        height: theme.space(7),
        width: theme.space(7),
        borderRadius: theme.radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.primarySoft,
    },
}));

/** Syn's mark beside its turns: the auth hero's badge, at message size. */
export const SynAvatar: FC = () => {
    return (
        <Box style={styles.avatar}>
            <SynMark size={20} />
        </Box>
    );
};
