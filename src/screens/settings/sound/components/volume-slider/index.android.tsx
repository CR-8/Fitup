import { FC } from 'react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import Slider from '@react-native-community/slider';

export interface VolumeSliderProps {
    value: number | undefined;
    onValueChange: (value: number) => void;
}

const styles = StyleSheet.create((theme) => ({
    slider: {
        width: '100%',
        height: theme.space(6),
    },
}));

export const VolumeSlider: FC<VolumeSliderProps> = ({ value, onValueChange }) => {
    const { theme, rt } = useUnistyles();

    return (
        <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={100}
            step={1}
            value={value}
            onValueChange={onValueChange}
            minimumTrackTintColor={
                rt.themeName === 'dark' ? theme.colors.white : theme.colors.neutral[950]
            }
            maximumTrackTintColor={theme.solid.foreground}
            thumbTintColor={
                rt.themeName === 'dark' ? theme.colors.white : theme.colors.neutral[950]
            }
        />
    );
};
