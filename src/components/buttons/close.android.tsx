import { useUnistyles, StyleSheet } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react-native';

import { Pressable } from '../primitives/pressable';
import { Box } from '../primitives/box';

interface CloseButtonProps {
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
    icon: {
        marginLeft: -theme.space(0.5),
    },
}));

const CloseButton = ({ backgroundColor, iconColor, onPressHandler }: CloseButtonProps) => {
    const { theme } = useUnistyles();
    const { t } = useTranslation(['common']);

    return (
        <Pressable
            onPress={onPressHandler}
            accessibilityRole="button"
            accessibilityLabel={t('close', { ns: 'common' })}
        >
            <Box style={styles.container(backgroundColor)}>
                <X
                    style={styles.icon}
                    size={theme.space(7)}
                    color={iconColor || theme.colors.typography}
                />
            </Box>
        </Pressable>
    );
};

export { CloseButton };
