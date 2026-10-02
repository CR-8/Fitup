import { FC } from 'react';
import { Slider } from '@expo/ui';

import { Host } from '@/components/native/host';

export interface VolumeSliderProps {
    value: number | undefined;
    onValueChange: (value: number) => void;
}

/** The system slider; `@/components/native/host` only resolves for iOS. */
export const VolumeSlider: FC<VolumeSliderProps> = ({ value, onValueChange }) => (
    <Host matchContents={{ vertical: true }}>
        <Slider
            min={0}
            max={100}
            step={1}
            value={value ?? 0}
            onValueChange={(next) => {
                onValueChange(Math.round(next));
            }}
        />
    </Host>
);
