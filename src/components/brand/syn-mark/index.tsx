import { FC } from 'react';
import Svg, { Circle, Path } from 'react-native-svg';
import { useUnistyles } from 'react-native-unistyles';

type SynMarkProps = {
    size?: number;
    /** Defaults to the brand red. */
    color?: string;
};

/**
 * Syn's own mark: an "S" inside a thin stopwatch ring. It replaces the generic
 * sparkle everywhere the AI coach appears. Drawn as paths, so it needs no font
 * and scales without blur.
 */
export const SynMark: FC<SynMarkProps> = ({ size = 24, color }) => {
    const { theme } = useUnistyles();
    const stroke = color ?? theme.colors.brand[500];

    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessibilityLabel="Syn">
            <Circle cx={12} cy={13.5} r={8.5} stroke={stroke} strokeWidth={1.25} />
            <Path
                d="M10 2.5h4M12 2.5v2M18.4 6.6l1.3-1.3"
                stroke={stroke}
                strokeWidth={1.25}
                strokeLinecap="round"
            />
            <Path
                d="M15.2 10.6C14.6 9.3 13.4 8.7 12 8.7C10.2 8.7 9 9.7 9 11C9 14.3 15.4 12.6 15.4 16C15.4 17.3 14 18.3 12.2 18.3C10.6 18.3 9.4 17.6 8.8 16.3"
                stroke={stroke}
                strokeWidth={2.1}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </Svg>
    );
};
