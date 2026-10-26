import React, { useCallback, useMemo, type FC } from 'react';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useTranslation } from 'react-i18next';
import { RelativePathString, router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import {
    LucideIcon,
    House,
    ChartNoAxesColumn,
    CircleUserRound,
    MessageCircle,
} from 'lucide-react-native';

import { Pressable } from '@/components/primitives/pressable';
import { Box } from '@/components/primitives/box';
import { Text } from '@/components/primitives/text';
import { HStack } from '@/components/primitives/hstack';
import { runInBackground } from '@/services/error-reporting';

type TabsType = Omit<BottomTabBarProps, 'descriptors' | 'insets' | 'navigation'>;

interface ItemType {
    isFocused: boolean;
    children: string;
    onPress: () => void;
    Icon: LucideIcon;
}

// The pill iOS's tab bar draws: icon over label, the current tab on a lighter
// capsule inside the glass, in the brand colour; the rest muted.
export const TAB_BAR_HEIGHT = 62;

const styles = StyleSheet.create((theme) => ({
    tabsContainer: {
        height: TAB_BAR_HEIGHT,
        padding: 4,
    },
    itemContainer: {
        flex: 1,
    },
    item: (isFocused: boolean) => ({
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        borderRadius: theme.radius.full,
        backgroundColor: isFocused ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
    }),
    itemText: (isFocused: boolean) => ({
        fontSize: 11,
        lineHeight: 13,
        color: isFocused ? theme.colors.primary : theme.colors.mutedTypography,
    }),
}));

const Item: FC<ItemType> = ({ isFocused, onPress, children, Icon }) => {
    const { theme } = useUnistyles();
    const { t } = useTranslation(['menu']);

    return (
        <Box style={styles.itemContainer}>
            <Pressable
                style={styles.item(isFocused)}
                animateOnPress={false}
                accessibilityRole="tab"
                accessibilityState={{ selected: isFocused }}
                onPressIn={() => {
                    runInBackground(
                        () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
                        'Failed to trigger tab haptic feedback:',
                    );
                    onPress();
                }}
            >
                <Icon
                    size={22}
                    strokeWidth={isFocused ? 2.25 : 1.75}
                    color={isFocused ? theme.colors.primary : theme.colors.mutedTypography}
                />
                <Text
                    fontWeight={isFocused ? 'semibold' : 'medium'}
                    style={styles.itemText(isFocused)}
                >
                    {t(children, { ns: 'menu' })}
                </Text>
            </Pressable>
        </Box>
    );
};

const Tabs: FC<TabsType> = ({ state }) => {
    const menu = useMemo(() => {
        // Home, Syn, Progress, Profile. Each tab is a route group, so
        // `screen` is the group's name.
        const items = [
            {
                screen: '(home)',
                href: '/',
                title: 'home.title',
                icon: House,
            },
            {
                screen: '(syn)',
                href: '/syn',
                title: 'syn.title',
                icon: MessageCircle,
            },
            {
                screen: '(results)',
                href: '/results',
                title: 'results.title',
                icon: ChartNoAxesColumn,
            },
            {
                screen: '(you)',
                href: '/you',
                title: 'you.title',
                icon: CircleUserRound,
            },
        ];

        return items;
    }, []);

    const isFocused = useCallback(
        (name: string) => {
            if (name === 'menu') {
                return !menu.map((i) => i.screen).includes(state.routes[state.index].name);
            }
            return name === state.routes[state.index].name;
        },
        [state, menu],
    );

    return (
        <HStack style={styles.tabsContainer}>
            {menu.map((item, index) => (
                <Item
                    key={index}
                    onPress={() => router.navigate(item.href as RelativePathString)}
                    isFocused={isFocused(item.screen)}
                    Icon={item.icon}
                >
                    {item.title}
                </Item>
            ))}
        </HStack>
    );
};

export default Tabs;
