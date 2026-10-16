import { useUnistyles, StyleSheet } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { Ellipsis } from 'lucide-react-native';

import { Pressable } from '../primitives/pressable';
import { Box } from '../primitives/box';

interface BackButtonProps {
    backgroundColor?: string;
    iconColor?: string;
    onPressHandler: () => void;
}

const styles = StyleSheet.create((theme) => ({
    container: (backgroundColor?: string) => ({
        height: theme.space(11),
        width: theme.space(11),
        backgroundColor: backgroundColor || theme.colors.foreground,
        borderRadius: theme.radius.full,
        justifyContent: 'center',
        alignItems: 'center',
    }),
}));

const ActionsButton = ({ backgroundColor, iconColor, onPressHandler }: BackButtonProps) => {
    const { theme } = useUnistyles();
    const { t } = useTranslation(['common']);

    return (
        <Pressable
            onPress={onPressHandler}
            accessibilityRole="button"
            accessibilityLabel={t('more', { ns: 'common' })}
        >
            <Box style={styles.container(backgroundColor)}>
                <Ellipsis size={theme.space(7)} color={iconColor || theme.colors.typography} />
            </Box>
        </Pressable>
    );
};

export { ActionsButton };
