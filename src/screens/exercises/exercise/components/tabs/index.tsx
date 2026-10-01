import { FC } from 'react';
import { StyleSheet } from 'react-native-unistyles';
import { SegmentedControl } from '@expo/ui/community/segmented-control';

interface TabsProps {
    tabs: string[];
    activeIndex: number;
    onTabChange: (index: number) => void;
}

const styles = StyleSheet.create((theme) => ({
    control: {
        marginHorizontal: theme.space(4),
    },
}));

/** The detail screen's sections, on the platform's segmented control. */
export const Tabs: FC<TabsProps> = ({ tabs, activeIndex, onTabChange }) => (
    <SegmentedControl
        style={styles.control}
        values={tabs}
        selectedIndex={activeIndex}
        onChange={({ nativeEvent }) => onTabChange(nativeEvent.selectedSegmentIndex)}
    />
);
