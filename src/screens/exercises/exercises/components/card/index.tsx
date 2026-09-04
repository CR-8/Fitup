import { memo, ReactNode, useCallback, useMemo } from 'react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Reanimated, { SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { ChevronDown, Trash2 } from 'lucide-react-native';

import { Text } from '@/components/primitives/text';
import { Box } from '@/components/primitives/box';
import { HStack } from '@/components/primitives/hstack';
import { VStack } from '@/components/primitives/vstack';
import { Pressable } from '@/components/primitives/pressable';
import { stableOutlineWidth } from '@/helpers/styles';
import { ExerciseListItem } from '@/hooks/use-exercises';
import { exerciseDisplayName } from '@/helpers/exercise-name';

const styles = StyleSheet.create((theme) => ({
    categoryHeaderContainer: {
        paddingTop: theme.space(6),
        paddingBottom: theme.space(2),
        paddingHorizontal: theme.space(4),
        backgroundColor: theme.colors.background,
    },
    // The eyebrow treatment from the design: small, quiet and spaced out, so it
    // labels the section without competing with the muscle groups under it.
    categoryEyebrow: {
        color: theme.colors.mutedTypography,
        fontSize: theme.fontSize['2xs'].fontSize,
        lineHeight: theme.fontSize['2xs'].lineHeight,
        letterSpacing: 1.8,
        textTransform: 'uppercase',
    },
    sectionDivider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: theme.colors.border,
    },
    categoryHeaderWrapper: {
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    categoryTitle: {
        color: theme.colors.typography,
    },
    categoryCount: {
        color: theme.colors.typography,
        opacity: 0.6,
    },
    // This is the control people actually use, so it gets a real row height and
    // a card of its own rather than reading as a caption.
    muscleGroupHeaderContainer: (open: boolean) => ({
        minHeight: theme.space(13),
        justifyContent: 'center',
        paddingVertical: theme.space(3),
        paddingHorizontal: theme.space(4),
        marginHorizontal: theme.space(4),
        marginTop: theme.space(2),
        borderRadius: theme.radius['2xl'],
        backgroundColor: open ? theme.colors.elevated : theme.colors.foreground,
    }),
    muscleGroupChevron: (open: boolean) => ({
        transform: [{ rotate: open ? '180deg' : '0deg' }],
    }),
    countPill: {
        paddingHorizontal: theme.space(2),
        paddingVertical: theme.space(0.5),
        borderRadius: theme.radius.full,
        backgroundColor: theme.colors.background,
    },
    headerRight: {
        alignItems: 'center',
        gap: theme.space(2),
    },
    muscleGroupHeaderWrapper: {
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    muscleGroupTitle: {
        color: theme.colors.typography,
    },
    muscleGroupCount: {
        color: theme.colors.mutedTypography,
    },
    exerciseItemContainer: (left: boolean, right: boolean) => ({
        paddingVertical: theme.space(2),
        paddingLeft: left ? theme.space(0) : theme.space(4),
        paddingRight: right ? theme.space(0) : theme.space(4),
    }),
    exerciseName: {
        color: theme.colors.typography,
    },
    exerciseTracking: {
        color: theme.colors.mutedTypography,
        marginTop: theme.space(1),
    },
    exerciseItemSeparator: (borderStyle: 'default' | 'wide' | 'none') => ({
        height: borderStyle === 'none' ? 0 : StyleSheet.hairlineWidth,
        backgroundColor: theme.colors.border,
        marginHorizontal: borderStyle === 'wide' ? 0 : theme.space(4),
    }),
    selectCircle: (selected: boolean) => ({
        width: theme.space(6),
        height: theme.space(6),
        borderRadius: theme.space(5),
        borderWidth: stableOutlineWidth,
        borderColor: selected ? theme.colors.typography : theme.colors.border,
        backgroundColor: selected ? theme.colors.typography : 'transparent',
    }),
    selectPressable: {
        paddingHorizontal: 16,
    },
    swipeable: {
        backgroundColor: theme.colors.red[500],
    },
    swipeableContainer: {
        backgroundColor: theme.colors.background,
        width: '100%',
    },
    rightAction: {
        width: 75,
        height: '100%',
        backgroundColor: theme.colors.red[500],
        justifyContent: 'center',
        alignItems: 'center',
    },
    exerciseRow: {
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    exerciseContentFlex: {
        flex: 1,
    },
}));

interface ExerciseListItemProps {
    item: ExerciseListItem;
    onPress?: (item: ExerciseListItem) => void;
    onDelete?: (exerciseId: string) => void;
    index: number;
    data: ExerciseListItem[];
    renderRightAccessory?: (item: ExerciseListItem & { type: 'exercise' }) => ReactNode | null;
    renderLeftAccessory?: (item: ExerciseListItem & { type: 'exercise' }) => ReactNode | null;
    selectable?: boolean;
    selected?: boolean;
    onSelectToggle?: (exerciseId: string) => void;
    selectionPosition?: 'left' | 'right';
    /** Headers only. Absent while searching, when nothing may be shut. */
    sectionOpen?: boolean;
    onToggleSection?: () => void;
}

interface RightActionProps {
    prog: SharedValue<number>;
    drag: SharedValue<number>;
    handleDelete: () => void;
}

interface SelectionAccessoryProps {
    selected: boolean;
    onToggle: () => void;
}

const CategoryHeaderComponent = ({
    item,
    open = true,
    onToggle,
}: {
    item: ExerciseListItem & { type: 'category' };
    open?: boolean;
    onToggle?: () => void;
}) => {
    const { t } = useTranslation(['common']);
    const { theme } = useUnistyles();

    return (
        <Pressable onPress={onToggle} disabled={!onToggle}>
            <Box style={styles.categoryHeaderContainer}>
                <HStack style={styles.categoryHeaderWrapper}>
                    <Text fontWeight="semibold" style={styles.categoryEyebrow}>
                        {t(`exerciseCategory.${item.name}`, { ns: 'common' })} · {item.count}
                    </Text>
                    {onToggle ? (
                        <Box style={styles.muscleGroupChevron(open)}>
                            <ChevronDown size={16} color={theme.colors.mutedTypography} />
                        </Box>
                    ) : null}
                </HStack>
            </Box>
        </Pressable>
    );
};

const CategoryHeader = memo(CategoryHeaderComponent);

const MuscleGroupHeaderComponent = ({
    item,
    open = false,
    onToggle,
}: {
    item: ExerciseListItem & { type: 'muscle-group' };
    open?: boolean;
    onToggle?: () => void;
}) => {
    const { t } = useTranslation(['common']);
    const { theme } = useUnistyles();

    return (
        <Pressable onPress={onToggle} disabled={!onToggle}>
            <Box style={styles.muscleGroupHeaderContainer(open)}>
                <HStack style={styles.muscleGroupHeaderWrapper}>
                    <Text fontWeight="semibold" style={styles.muscleGroupTitle}>
                        {t(`muscleGroup.${item.name}`, { ns: 'common' })}
                    </Text>
                    <HStack style={styles.headerRight}>
                        <Box style={styles.countPill}>
                            <Text fontSize="xs" fontWeight="medium" style={styles.muscleGroupCount}>
                                {item.count}
                            </Text>
                        </Box>
                        {onToggle ? (
                            <Box style={styles.muscleGroupChevron(open)}>
                                <ChevronDown size={18} color={theme.colors.mutedTypography} />
                            </Box>
                        ) : null}
                    </HStack>
                </HStack>
            </Box>
        </Pressable>
    );
};

const MuscleGroupHeader = memo(MuscleGroupHeaderComponent);

const RightActionComponent = ({ prog, drag, handleDelete }: RightActionProps) => {
    const { theme } = useUnistyles();

    const styleAnimation = useAnimatedStyle(() => {
        return {
            transform: [{ translateX: drag.value + 75 }],
        };
    });

    return (
        <Reanimated.View style={[styles.rightAction, styleAnimation]}>
            <Pressable onPress={handleDelete}>
                <Trash2 color={theme.colors.neutral[50]} size={theme.space(6)} strokeWidth={1.75} />
            </Pressable>
        </Reanimated.View>
    );
};

const RightAction = memo(RightActionComponent);

const SelectionAccessoryComponent = ({ selected, onToggle }: SelectionAccessoryProps) => (
    <Pressable onPress={onToggle} style={styles.selectPressable}>
        <Box style={styles.selectCircle(!!selected)} />
    </Pressable>
);

const SelectionAccessory = memo(SelectionAccessoryComponent);

const ExerciseCardComponent = ({
    item,
    onPress,
    onDelete,
    index,
    data,
    renderRightAccessory,
    renderLeftAccessory,
    selectable,
    selected,
    onSelectToggle,
    selectionPosition = 'left',
}: {
    item: ExerciseListItem & { type: 'exercise' };
    onPress?: (item: ExerciseListItem) => void;
    onDelete?: (exerciseId: string) => void;
    index: number;
    data: ExerciseListItem[];
    renderRightAccessory?: (item: ExerciseListItem & { type: 'exercise' }) => ReactNode | null;
    renderLeftAccessory?: (item: ExerciseListItem & { type: 'exercise' }) => ReactNode | null;
    selectable?: boolean;
    selected?: boolean;
    onSelectToggle?: (exerciseId: string) => void;
    selectionPosition?: 'left' | 'right';
}) => {
    const { t } = useTranslation(['common']);

    const handlePress = useCallback(() => {
        onPress?.(item);
    }, [onPress, item]);

    const borderStyle = useMemo(() => {
        if (index === data.length - 1) {
            return 'none';
        }

        const nextItem = data[index + 1];
        if (nextItem && (nextItem.type === 'category' || nextItem.type === 'muscle-group')) {
            return 'wide';
        }

        return 'default';
    }, [data, index]);

    const handleSelectToggle = useCallback(() => {
        onSelectToggle?.(item.exercise.id);
    }, [onSelectToggle, item.exercise.id]);

    const showLeftSelection = selectable && selectionPosition === 'left';
    const showRightSelection = selectable && selectionPosition === 'right';

    const handleDelete = useCallback(() => {
        onDelete?.(item.exercise.id);
    }, [onDelete, item.exercise.id]);

    const renderRightActions = useCallback(
        (prog: SharedValue<number>, drag: SharedValue<number>) => (
            <RightAction prog={prog} drag={drag} handleDelete={handleDelete} />
        ),
        [handleDelete],
    );

    const leftAccessory = !showLeftSelection ? renderLeftAccessory?.(item) : null;
    const rightAccessory = !showRightSelection ? renderRightAccessory?.(item) : null;
    const hasLeft = showLeftSelection || !!leftAccessory;
    const hasRight = showRightSelection || !!rightAccessory;

    const exerciseRow = (
        <HStack style={styles.exerciseRow}>
            {showLeftSelection ? (
                <SelectionAccessory selected={!!selected} onToggle={handleSelectToggle} />
            ) : leftAccessory ? (
                leftAccessory
            ) : null}
            <VStack
                style={[
                    styles.exerciseItemContainer(hasLeft, hasRight),
                    styles.exerciseContentFlex,
                ]}
            >
                <Text style={styles.exerciseName}>{exerciseDisplayName(item.exercise)}</Text>
                <Text fontSize="xs" style={styles.exerciseTracking}>
                    {item.exercise.tracking
                        .map((v) => t(`exerciseTracking.${v}`, { ns: 'common' }))
                        .join(' + ')}
                </Text>
            </VStack>
            {showRightSelection ? (
                <SelectionAccessory selected={!!selected} onToggle={handleSelectToggle} />
            ) : rightAccessory ? (
                rightAccessory
            ) : null}
        </HStack>
    );

    return (
        <Pressable onPress={handlePress}>
            {onDelete ? (
                <Swipeable
                    containerStyle={styles.swipeable}
                    childrenContainerStyle={styles.swipeableContainer}
                    friction={2}
                    enableTrackpadTwoFingerGesture
                    rightThreshold={40}
                    renderRightActions={renderRightActions}
                >
                    {exerciseRow}
                </Swipeable>
            ) : (
                exerciseRow
            )}
            <Box style={styles.exerciseItemSeparator(borderStyle)} />
        </Pressable>
    );
};

const ExerciseCard = memo(ExerciseCardComponent);

const ExerciseListItemComponentInner = ({
    item,
    onPress,
    onDelete,
    index,
    data,
    renderRightAccessory,
    renderLeftAccessory,
    selectable,
    selected,
    onSelectToggle,
    selectionPosition,
    sectionOpen,
    onToggleSection,
}: ExerciseListItemProps) => {
    switch (item.type) {
        case 'category':
            return <CategoryHeader item={item} open={sectionOpen} onToggle={onToggleSection} />;
        case 'muscle-group':
            return <MuscleGroupHeader item={item} open={sectionOpen} onToggle={onToggleSection} />;
        case 'exercise':
            return (
                <ExerciseCard
                    item={item}
                    onPress={onPress}
                    onDelete={onDelete}
                    index={index}
                    data={data}
                    renderRightAccessory={renderRightAccessory}
                    renderLeftAccessory={renderLeftAccessory}
                    selectable={selectable}
                    selected={selected}
                    onSelectToggle={onSelectToggle}
                    selectionPosition={selectionPosition}
                />
            );
        default:
            return null;
    }
};

export const ExerciseListItemComponent = memo(ExerciseListItemComponentInner);
