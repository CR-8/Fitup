import { FC } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import { StyleSheet } from 'react-native-unistyles';

/**
 * The sheet's line-art header, after Apple Fitness's plan builder: a faint grid
 * with a few diagonals and three rings in Syn's blue.
 */

const W = 360;
const H = 170;
const GRID = '#2a2e35';
const RING = '#5AB0FF';

const styles = StyleSheet.create({
    art: {
        height: H,
        marginHorizontal: -16,
        overflow: 'hidden',
    },
});

export const HeaderArt: FC = () => (
    <View style={styles.art} pointerEvents="none">
        <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice">
            {[60, 120, 180, 240, 300].map((x) => (
                <Line key={`v${x}`} x1={x} y1={0} x2={x} y2={H} stroke={GRID} strokeWidth={1} />
            ))}
            <Line x1={0} y1={85} x2={W} y2={85} stroke={GRID} strokeWidth={1} />
            <Line x1={120} y1={85} x2={180} y2={0} stroke={GRID} strokeWidth={1} />
            <Line x1={180} y1={85} x2={262} y2={H} stroke={GRID} strokeWidth={1} />
            <Circle cx={112} cy={108} r={42} stroke={RING} strokeWidth={1.5} fill="none" />
            <Circle cx={222} cy={86} r={24} stroke={RING} strokeWidth={1.5} fill="none" />
            <Circle cx={318} cy={14} r={46} stroke={RING} strokeWidth={1.5} fill="none" />
        </Svg>
    </View>
);
