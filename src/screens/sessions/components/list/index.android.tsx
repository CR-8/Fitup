import { FC } from 'react';
import { ScrollView, SectionList, View } from 'react-native';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { StyleSheet } from 'react-native-unistyles';

import { HStack } from '@/components/primitives/hstack';
import { Icon } from '@/components/primitives/icon';
import { Pressable } from '@/components/primitives/pressable';
import { Text } from '@/components/primitives/text';
import { VStack } from '@/components/primitives/vstack';

import type { SessionRow } from '../../data';
import { SESSION_COLORS, type SessionListProps } from './types';

/**
 * Sessions on Android, drawn by the app: pill filters, a month header with its
 * totals, and rows that swipe left to show Delete, as iOS's list does.
 */

const styles = StyleSheet.create((theme, rt) => ({
    list: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    content: {
        paddingTop: rt.insets.top + theme.space(2),
        paddingBottom: rt.insets.bottom + theme.space(10),
        paddingHorizontal: theme.space(4),
    },
    header: {
        gap: theme.space(4),
        paddingBottom: theme.space(2),
    },
    chips: {
        gap: theme.space(2),
    },
    chip: (selected: boolean) => ({
        minHeight: 36,
        justifyContent: 'center',
        paddingHorizontal: theme.space(4),
        borderRadius: theme.radius.full,
        backgroundColor: selected ? SESSION_COLORS.duration : theme.colors.elevated,
    }),
    chipText: (selected: boolean) => ({
        ...theme.fontSize.sm,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: selected ? theme.colors.neutral[950] : theme.colors.typography,
    }),
    month: {
        gap: theme.space(2),
        paddingTop: theme.space(5),
        paddingBottom: theme.space(2),
        backgroundColor: theme.colors.background,
    },
    monthTitle: {
        ...theme.fontSize['2xl'],
        fontWeight: theme.fontWeight.bold.fontWeight,
        color: theme.colors.typography,
    },
    tableLabel: {
        width: 110,
        color: theme.colors.typography,
    },
    tableCell: {
        width: 92,
        color: theme.colors.mutedTypography,
    },
    swipe: {
        marginBottom: theme.space(2),
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space(3),
        padding: theme.space(3),
        borderRadius: theme.radius['4xl'],
        borderCurve: 'continuous',
        backgroundColor: theme.colors.foreground,
    },
    icon: {
        height: 48,
        width: 48,
        borderRadius: theme.radius.xl,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: `${SESSION_COLORS.duration}26`,
    },
    rowText: {
        flex: 1,
    },
    name: {
        ...theme.fontSize.default,
        color: theme.colors.typography,
    },
    duration: {
        fontSize: 28,
        lineHeight: 34,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: SESSION_COLORS.duration,
    },
    date: {
        ...theme.fontSize.sm,
        alignSelf: 'flex-end',
        color: theme.colors.mutedTypography,
    },
    delete: {
        width: 88,
        marginLeft: theme.space(2),
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: theme.radius.xl,
        backgroundColor: theme.colors.red[500],
    },
    deleteText: {
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: theme.colors.white,
    },
    empty: {
        paddingTop: theme.space(6),
        color: theme.colors.mutedTypography,
    },
}));

export const SessionList: FC<SessionListProps> = ({
    header,
    chips,
    selected,
    onSelect,
    groups,
    labels,
    onOpen,
    onDelete,
}) => (
    <SectionList
        style={styles.list}
        contentContainerStyle={styles.content}
        sections={groups.map((group) => ({ ...group, data: group.rows }))}
        keyExtractor={(row) => row.id}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={
            <VStack style={styles.header}>
                {header}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chips}
                >
                    {chips.map((chip) => (
                        <Pressable
                            key={chip.key}
                            style={styles.chip(chip.key === selected)}
                            onPress={() => onSelect(chip.key)}
                            accessibilityRole="button"
                            accessibilityState={{ selected: chip.key === selected }}
                        >
                            <Text style={styles.chipText(chip.key === selected)}>{chip.label}</Text>
                        </Pressable>
                    ))}
                </ScrollView>
            </VStack>
        }
        ListEmptyComponent={<Text style={styles.empty}>{labels.empty}</Text>}
        renderSectionHeader={({ section }) => (
            <VStack style={styles.month}>
                <Text style={styles.monthTitle}>{section.title}</Text>
                {section.summary ? (
                    <VStack>
                        <HStack>
                            <View style={styles.tableLabel} />
                            <Text style={styles.tableCell}>{labels.total}</Text>
                            <Text style={styles.tableCell}>{labels.average}</Text>
                        </HStack>
                        {(
                            [
                                [labels.workouts, [String(section.summary.count), ''], undefined],
                                [labels.time, section.summary.time, SESSION_COLORS.time],
                                [
                                    labels.kcal,
                                    section.summary.kcal.map((v) => (v === '–' ? v : `${v} KCAL`)),
                                    SESSION_COLORS.kcal,
                                ],
                            ] as const
                        ).map(([label, values, color]) => (
                            <HStack key={label}>
                                <Text style={styles.tableLabel}>{label}</Text>
                                {values.map((value, i) => (
                                    <Text
                                        key={i}
                                        style={[styles.tableCell, color ? { color } : null]}
                                    >
                                        {value}
                                    </Text>
                                ))}
                            </HStack>
                        ))}
                    </VStack>
                ) : null}
            </VStack>
        )}
        renderItem={({ item }: { item: SessionRow }) => (
            <Swipeable
                containerStyle={styles.swipe}
                friction={2}
                rightThreshold={40}
                renderRightActions={(_progress, _drag, swipeable) => (
                    <Pressable
                        style={styles.delete}
                        onPress={() => {
                            swipeable.close();
                            onDelete(item.id);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={labels.delete}
                    >
                        <Text style={styles.deleteText}>{labels.delete}</Text>
                    </Pressable>
                )}
            >
                <Pressable style={styles.row} onPress={() => onOpen(item.id)}>
                    <View style={styles.icon}>
                        <Icon name="dumbbell" size={22} color={SESSION_COLORS.duration} />
                    </View>
                    <VStack style={styles.rowText}>
                        <Text style={styles.name} numberOfLines={1}>
                            {item.name}
                        </Text>
                        <Text style={styles.duration}>{item.duration}</Text>
                    </VStack>
                    <Text style={styles.date}>{item.date}</Text>
                </Pressable>
            </Swipeable>
        )}
    />
);
