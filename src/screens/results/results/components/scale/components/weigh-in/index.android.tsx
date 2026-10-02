import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Plus } from 'lucide-react-native';

import { Box } from '@/components/primitives/box';
import { Button } from '@/components/buttons/base';

interface WeighInButtonProps {
    onPress: () => void;
}

const styles = StyleSheet.create((theme, rt) => ({
    prefixBox: {
        backgroundColor: rt.themeName === 'dark' ? theme.colors.white : theme.colors.neutral[950],
        borderRadius: theme.radius.full,
        justifyContent: 'center',
        alignItems: 'center',
        height: theme.space(8),
        width: theme.space(8),
        marginTop: theme.space(1.5),
    },
}));

const WeighInButton = ({ onPress }: WeighInButtonProps) => {
    const { theme, rt } = useUnistyles();

    return (
        <Button
            type="link"
            prefix={
                <Box style={styles.prefixBox}>
                    <Plus
                        size={theme.space(5.5)}
                        color={
                            rt.themeName === 'dark' ? theme.colors.neutral[950] : theme.colors.white
                        }
                    />
                </Box>
            }
            onPress={onPress}
        />
    );
};

export { WeighInButton };
