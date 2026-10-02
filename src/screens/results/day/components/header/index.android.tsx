import { StyleSheet } from 'react-native-unistyles';

import { Box } from '@/components/primitives/box';
import { HStack } from '@/components/primitives/hstack';
import { CloseButton } from '@/components/buttons/close';
import { Title } from '@/components/typography/title';

interface HeaderProps {
    title: string;
    handleClose: () => void;
}

const styles = StyleSheet.create((theme) => ({
    header: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        justifyContent: 'flex-end',
        height: theme.screenHeaderHeight(),
        paddingHorizontal: theme.space(4),
    },
    headerRow: {
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    headerTitleContainer: {
        minWidth: 0,
        alignItems: 'flex-start',
        justifyContent: 'center',
    },
}));

const Header = ({ title, handleClose }: HeaderProps) => {
    return (
        <Box style={styles.header}>
            <HStack style={styles.headerRow}>
                <Box style={styles.headerTitleContainer}>
                    <Title type="h2">{title}</Title>
                </Box>
                <CloseButton onPressHandler={handleClose} />
            </HStack>
        </Box>
    );
};

export { Header };
