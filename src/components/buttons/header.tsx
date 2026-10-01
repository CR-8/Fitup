import { FC } from 'react';
import { View } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';

import { Pressable } from '../primitives/pressable';
import { Icon, type IconName } from '../primitives/icon';
import { Text } from '../primitives/text';

interface HeaderButtonProps {
    icon: IconName;
    /** Omit when the button is a menu trigger: the menu owns the tap. */
    onPress?: () => void;
    accessibilityLabel?: string;
    /** A dot for "something is applied", e.g. active filters. */
    badge?: boolean;
}

/** A bare glyph for a native header slot; the platform draws the button chrome. */
export const HeaderButton: FC<HeaderButtonProps> = ({
    icon,
    onPress,
    accessibilityLabel,
    badge,
}) => {
    const { theme } = useUnistyles();

    const glyph = (
        <View style={{ padding: theme.space(1) }}>
            <Icon name={icon} size={22} color={theme.colors.typography} />
            {badge && (
                <View
                    style={{
                        position: 'absolute',
                        top: 2,
                        right: 2,
                        height: 8,
                        width: 8,
                        borderRadius: 4,
                        backgroundColor: theme.colors.primary,
                    }}
                />
            )}
        </View>
    );

    if (!onPress) return glyph;

    return (
        <Pressable
            onPress={onPress}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel}
        >
            {glyph}
        </Pressable>
    );
};

interface HeaderTextButtonProps {
    title: string;
    onPress: () => void;
    disabled?: boolean;
    /** The confirming action (Save, Done) reads heavier, as on iOS. */
    prominent?: boolean;
}

/** Cancel / Save style header action: tinted text, the platform's own idiom. */
export const HeaderTextButton: FC<HeaderTextButtonProps> = ({
    title,
    onPress,
    disabled,
    prominent,
}) => {
    const { theme } = useUnistyles();

    return (
        <Pressable onPress={onPress} disabled={disabled} hitSlop={8} accessibilityRole="button">
            <Text
                style={{
                    fontSize: 17,
                    color: theme.colors.primary,
                    fontWeight: prominent ? '600' : '400',
                    opacity: disabled ? 0.4 : 1,
                    paddingHorizontal: theme.space(1),
                }}
            >
                {title}
            </Text>
        </Pressable>
    );
};
