import { FC } from 'react';
import { StyleSheet, UnistylesVariants } from 'react-native-unistyles';

import { Pressable } from '@/components/primitives/pressable';
import { Box } from '@/components/primitives/box';
import { HStack } from '@/components/primitives/hstack';
import { Text } from '@/components/primitives/text';
import { VStack } from '@/components/primitives/vstack';
import { useActionsStore } from '@/stores/actions';
import type { ActionMenu } from '@/hooks/use-action-menus';

type MenuItemProps = {
    title: string;
    description?: string;
    last?: boolean;
    disabled?: boolean;
    onPress: () => void;
} & UnistylesVariants<typeof styles>;

const styles = StyleSheet.create((theme) => ({
    container: {
        paddingHorizontal: theme.space(5),
        paddingVertical: theme.space(4),
    },
    disabled: {
        opacity: 0.5,
    },
    divider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: theme.colors.border,
    },
    wrapper: {
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    titleContainer: {
        flex: 1,
        gap: theme.space(1),
    },
    title: {
        fontSize: theme.fontSize.default.fontSize,
        fontWeight: theme.fontWeight.medium.fontWeight,
        variants: {
            variant: {
                default: {
                    color: theme.colors.typography,
                },
                destructive: {
                    color: theme.colors.red[500],
                },
            },
        },
    },
    description: {
        ...theme.fontSize.sm,
        color: theme.colors.typography,
        opacity: 0.55,
    },
}));

const MenuItem: FC<MenuItemProps> = ({ title, description, last, variant, disabled, onPress }) => {
    styles.useVariants({ variant });

    return (
        <Pressable accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}>
            <Box style={disabled && styles.disabled}>
                <Box style={styles.container}>
                    <HStack style={styles.wrapper}>
                        <Box style={styles.titleContainer}>
                            <Text style={styles.title}>{title}</Text>
                            {description && <Text style={styles.description}>{description}</Text>}
                        </Box>
                    </HStack>
                </Box>
                {!last && <Box style={styles.divider} />}
            </Box>
        </Pressable>
    );
};

type MenuItemsProps = {
    menu: ActionMenu;
    /** A second line under an item's title, by action id. */
    describe?: (id: string) => string | undefined;
};

/** A shared action menu (`use-action-menus`) as rows of the sheet; picking one closes it. */
const MenuItems: FC<MenuItemsProps> = ({ menu, describe }) => {
    const close = useActionsStore((state) => state.close);
    const items = menu.actions.flatMap(({ id, ...action }) =>
        id && !action.attributes?.hidden ? [{ ...action, id }] : [],
    );

    return (
        <VStack>
            {items.map((action, index) => (
                <MenuItem
                    key={action.id}
                    title={action.title}
                    description={describe?.(action.id)}
                    variant={action.attributes?.destructive ? 'destructive' : undefined}
                    disabled={action.attributes?.disabled}
                    last={index === items.length - 1}
                    onPress={() => {
                        close();
                        menu.onAction(action.id);
                    }}
                />
            ))}
        </VStack>
    );
};

export { MenuItem, MenuItems };
