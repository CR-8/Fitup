import { FC } from 'react';
import { ActivityIndicator, type ColorValue } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';

interface SpinnerProps {
    color?: ColorValue;
    size?: number;
}

const Spinner: FC<SpinnerProps> = ({ color, size }) => {
    const { theme } = useUnistyles();

    return (
        <ActivityIndicator
            color={color ?? theme.colors.mutedTypography}
            size={size && size > 30 ? 'large' : 'small'}
        />
    );
};

export default Spinner;
