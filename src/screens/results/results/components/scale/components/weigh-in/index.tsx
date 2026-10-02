import { useTranslation } from 'react-i18next';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Box } from '@/components/primitives/box';
import { Pressable } from '@/components/primitives/pressable';
import { Icon } from '@/components/primitives/icon';

interface WeighInButtonProps {
    onPress: () => void;
}

const styles = StyleSheet.create((theme) => ({
    prefixBox: {
        backgroundColor: theme.colors.primary,
        borderRadius: theme.radius.full,
        justifyContent: 'center',
        alignItems: 'center',
        height: theme.space(8),
        width: theme.space(8),
        marginTop: theme.space(1.5),
    },
}));

const WeighInButton = ({ onPress }: WeighInButtonProps) => {
    const { t } = useTranslation(['screens']);
    const { theme } = useUnistyles();

    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={t('results.scale.actions.weighIn', { ns: 'screens' })}
        >
            <Box style={styles.prefixBox}>
                <Icon name="plus" size={theme.space(5.5)} color={theme.colors.primaryTypography} />
            </Box>
        </Pressable>
    );
};

export { WeighInButton };
