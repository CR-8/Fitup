import { FC } from 'react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Box } from '@/components/primitives/box';
import { Icon } from '@/components/primitives/icon';

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
    const { theme } = useUnistyles();

    return (
        <Box style={styles.avatar}>
            <Icon name="sparkles" size={theme.space(3.5)} color={theme.colors.primary} />
        </Box>
    );
};
