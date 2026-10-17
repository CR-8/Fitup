import { FC } from 'react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import {
    Button,
    HStack,
    Host,
    Image,
    List,
    ScrollView,
    Section,
    Spacer,
    SwipeActions,
    Text,
    VStack,
} from '@expo/ui/swift-ui';
import {
    background,
    buttonBorderShape,
    buttonStyle,
    contentShape,
    font,
    foregroundStyle,
    frame,
    headerProminence,
    listRowBackground,
    listRowSpacing,
    listStyle,
    onTapGesture,
    scrollContentBackground,
    shapes,
    tint,
} from '@expo/ui/swift-ui/modifiers';

import { SESSION_COLORS, type SessionListProps } from './types';

/**
 * Sessions on iOS: a SwiftUI list, so a row swipes to Delete natively. The
 * filters ride in its first row and each month is a section. Android draws
 * its own (`index.android.tsx`).
 */

const styles = StyleSheet.create({
    host: { flex: 1 },
});

const secondary = foregroundStyle({ type: 'hierarchical', style: 'secondary' });
const COLUMN = frame({ width: 92, alignment: 'leading' });

export const SessionList: FC<SessionListProps> = ({
    header,
    chips,
    selected,
    onSelect,
    groups,
    labels,
    onOpen,
    onDelete,
}) => {
    const { theme } = useUnistyles();
    const card = listRowBackground(theme.colors.elevated as string);
    const clear = listRowBackground('transparent');

    return (
        <>
            {header}
            <Host style={styles.host}>
                <List
                    modifiers={[
                        listStyle('insetGrouped'),
                        scrollContentBackground('hidden'),
                        listRowSpacing(8),
                    ]}
                >
                    <Section>
                        <ScrollView axes="horizontal" showsIndicators={false} modifiers={[clear]}>
                            <HStack spacing={8}>
                                {chips.map((chip) => (
                                    <Button
                                        key={chip.key}
                                        label={chip.label}
                                        onPress={() => onSelect(chip.key)}
                                        modifiers={[
                                            buttonStyle(
                                                chip.key === selected
                                                    ? 'borderedProminent'
                                                    : 'bordered',
                                            ),
                                            buttonBorderShape('capsule'),
                                            ...(chip.key === selected
                                                ? [tint(SESSION_COLORS.duration)]
                                                : []),
                                        ]}
                                    />
                                ))}
                            </HStack>
                        </ScrollView>
                    </Section>

                    {groups.length === 0 ? (
                        <Section>
                            <Text modifiers={[secondary, clear]}>{labels.empty}</Text>
                        </Section>
                    ) : null}

                    {groups.map((group) => (
                        <Section
                            key={group.key}
                            title={group.title}
                            modifiers={[headerProminence('increased')]}
                        >
                            {group.summary ? (
                                <VStack alignment="leading" spacing={4} modifiers={[clear]}>
                                    <HStack>
                                        <Text modifiers={[frame({ width: 110 })]}> </Text>
                                        <Text modifiers={[COLUMN, secondary]}>{labels.total}</Text>
                                        <Text modifiers={[COLUMN, secondary]}>
                                            {labels.average}
                                        </Text>
                                        <Spacer />
                                    </HStack>
                                    {(
                                        [
                                            [
                                                labels.workouts,
                                                [String(group.summary.count), ''],
                                                undefined,
                                            ],
                                            [labels.time, group.summary.time, SESSION_COLORS.time],
                                            [
                                                labels.kcal,
                                                group.summary.kcal.map((v) =>
                                                    v === '–' ? v : `${v} KCAL`,
                                                ),
                                                SESSION_COLORS.kcal,
                                            ],
                                        ] as const
                                    ).map(([label, [total, average], color]) => (
                                        <HStack key={label}>
                                            <Text
                                                modifiers={[
                                                    frame({ width: 110, alignment: 'leading' }),
                                                ]}
                                            >
                                                {label}
                                            </Text>
                                            {[total, average].map((value, i) => (
                                                <Text
                                                    key={i}
                                                    modifiers={[
                                                        COLUMN,
                                                        color ? foregroundStyle(color) : secondary,
                                                    ]}
                                                >
                                                    {value}
                                                </Text>
                                            ))}
                                            <Spacer />
                                        </HStack>
                                    ))}
                                </VStack>
                            ) : null}

                            {group.rows.map((row) => (
                                <SwipeActions key={row.id} modifiers={[card]}>
                                    <HStack
                                        spacing={12}
                                        modifiers={[
                                            contentShape(shapes.rectangle()),
                                            onTapGesture(() => onOpen(row.id)),
                                        ]}
                                    >
                                        <Image
                                            systemName="dumbbell.fill"
                                            size={22}
                                            color={SESSION_COLORS.duration}
                                            modifiers={[
                                                frame({ width: 48, height: 48 }),
                                                background(
                                                    `${SESSION_COLORS.duration}26`,
                                                    shapes.roundedRectangle({ cornerRadius: 12 }),
                                                ),
                                            ]}
                                        />
                                        <VStack alignment="leading" spacing={0}>
                                            <Text modifiers={[font({ size: 17 })]}>{row.name}</Text>
                                            <Text
                                                modifiers={[
                                                    font({
                                                        size: 30,
                                                        weight: 'medium',
                                                        design: 'rounded',
                                                    }),
                                                    foregroundStyle(SESSION_COLORS.duration),
                                                ]}
                                            >
                                                {row.duration}
                                            </Text>
                                        </VStack>
                                        <Spacer />
                                        <Text
                                            modifiers={[
                                                font({ size: 15 }),
                                                secondary,
                                                frame({ maxHeight: Infinity, alignment: 'bottom' }),
                                            ]}
                                        >
                                            {row.date}
                                        </Text>
                                    </HStack>
                                    <SwipeActions.Actions edge="trailing">
                                        <Button
                                            role="destructive"
                                            label={labels.delete}
                                            systemImage="trash"
                                            onPress={() => onDelete(row.id)}
                                        />
                                    </SwipeActions.Actions>
                                </SwipeActions>
                            ))}
                        </Section>
                    ))}
                </List>
            </Host>
        </>
    );
};
