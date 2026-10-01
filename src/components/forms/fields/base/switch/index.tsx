import { FC } from 'react';
import { StyleSheet } from 'react-native-unistyles';
import { FieldError, Merge } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Switch as UISwitch } from '@expo/ui';

import { HStack } from '@/components/primitives/hstack';
import { VStack } from '@/components/primitives/vstack';
import { BoxProps } from '@/components/primitives/box';
import { Text } from '@/components/primitives/text';
import { Host } from '@/components/native/host';

import { Error } from '../../components';

export interface SwitchType {
    value?: boolean;
    title: string;
    description?: string;
    onChange: (value: boolean) => void;
    containerStyle?: BoxProps['style'];
    error?: Merge<FieldError, (FieldError | undefined)[]> | undefined;
}

const styles = StyleSheet.create((theme) => ({
    container: {
        paddingVertical: theme.space(3),
        paddingHorizontal: theme.space(4),
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: theme.space(3),
    },
    text: {
        flex: 1,
        gap: theme.space(0.5),
    },
    title: (error: boolean) => ({
        color: error ? theme.colors.destructive : theme.colors.typography,
    }),
    description: {
        ...theme.fontSize.sm,
        color: theme.colors.mutedTypography,
    },
    errorContainer: {
        paddingHorizontal: theme.space(4),
        marginTop: -theme.space(2),
        marginBottom: theme.space(3),
    },
}));

/** A settings row: title and description, with the platform's own switch. */
const Switch: FC<SwitchType> = ({ value, title, description, onChange, containerStyle, error }) => {
    const { t } = useTranslation(['common']);

    return (
        <VStack>
            <HStack style={[styles.container, containerStyle]}>
                <VStack style={styles.text}>
                    <Text style={styles.title(!!error)}>{title}</Text>
                    {description ? <Text style={styles.description}>{description}</Text> : null}
                </VStack>
                <Host matchContents>
                    <UISwitch value={!!value} onValueChange={onChange} />
                </Host>
            </HStack>
            {error?.message && (
                <Error containerStyle={styles.errorContainer}>
                    {t(error.message, { ns: 'common' })}
                </Error>
            )}
        </VStack>
    );
};

export { Switch };
