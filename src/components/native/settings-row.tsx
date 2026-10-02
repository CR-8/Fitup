import { FC } from 'react';
import { View } from 'react-native';
import { ListItem } from '@expo/ui';
import { useUnistyles } from 'react-native-unistyles';

import { Icon, type IconName } from '@/components/primitives/icon';
import { Text } from '@/components/primitives/text';

interface SettingsRowProps {
    title: string;
    icon?: IconName;
    /** The current setting, shown muted at the trailing edge. */
    value?: string;
    supportingText?: string;
    /** A disclosure chevron, for rows that push another screen (iOS only). */
    disclosure?: boolean;
    onPress?: () => void;
}

/** One row of a native grouped list (a `FieldGroup.Section`). */
export const SettingsRow: FC<SettingsRowProps> = ({
    title,
    icon,
    value,
    supportingText,
    disclosure,
    onPress,
}) => {
    const { theme } = useUnistyles();
    const chevron = disclosure;

    return (
        <ListItem
            onPress={onPress}
            supportingText={supportingText}
            leading={icon ? <Icon name={icon} size={20} color={theme.colors.primary} /> : undefined}
            trailing={
                value || chevron ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        {value ? (
                            <Text style={{ color: theme.colors.mutedTypography }}>{value}</Text>
                        ) : null}
                        {chevron ? (
                            <Icon
                                name="chevron-right"
                                size={13}
                                color={theme.colors.mutedTypography}
                            />
                        ) : null}
                    </View>
                ) : undefined
            }
        >
            {title}
        </ListItem>
    );
};
