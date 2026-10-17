import { useMemo } from 'react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { DatePicker, Host } from '@expo/ui/swift-ui';
import { datePickerStyle, environment, labelsHidden, tint } from '@expo/ui/swift-ui/modifiers';
import {
    Control,
    FieldError,
    FieldPath,
    FieldValues,
    Merge,
    PathValue,
    useController,
} from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { VStack } from '@/components/primitives/vstack';
import { HStack } from '@/components/primitives/hstack';
import { Box, BoxProps } from '@/components/primitives/box';
import { Text } from '@/components/primitives/text';

import { Error } from '../components';

interface DatetimeProps<
    T extends FieldValues = FieldValues,
    TName extends FieldPath<T> = FieldPath<T>,
> {
    control: Control<T>;
    name: TName;
    value?: PathValue<T, TName>;
    title: string;
    mode?: 'date' | 'datetime';
    minimumDate?: Date;
    maximumDate?: Date;
    description?: string;
    error?: Merge<FieldError, (FieldError | undefined)[]> | undefined;
    containerStyle?: BoxProps['style'];
}

const styles = StyleSheet.create((theme) => ({
    container: {
        paddingVertical: theme.space(3),
        paddingHorizontal: theme.space(4),
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    title: (error: boolean) => ({
        color: error ? theme.colors.destructive : theme.colors.typography,
    }),
    errorContainer: {
        paddingHorizontal: theme.space(5),
        marginTop: -theme.space(2),
        marginBottom: theme.space(3),
    },
}));

export function Datetime<T extends FieldValues, TName extends FieldPath<T>>({
    control,
    name,
    value: defaultValue,
    title,
    mode = 'datetime',
    minimumDate,
    maximumDate,
    description,
    error,
    containerStyle,
}: DatetimeProps<T, TName>) {
    const { theme, rt } = useUnistyles();
    const { t, i18n } = useTranslation(['common']);

    const {
        field: { onChange, value },
    } = useController({ name, control, defaultValue });

    const pickerValue = useMemo(
        () => (value ?? defaultValue ?? new Date()) as Date,
        [defaultValue, value],
    );

    return (
        <VStack>
            <HStack style={[styles.container, containerStyle]}>
                <VStack>
                    <Box>
                        <Text style={styles.title(!!error)}>{title}</Text>
                    </Box>
                    {description && (
                        <Box>
                            <Text>{description}</Text>
                        </Box>
                    )}
                </VStack>
                {/* One SwiftUI picker sized to its content both ways. The community
                    wrapper only matches height, so in a row each picker got zero width and
                    the date and time pills overflowed on top of each other. */}
                <Host matchContents>
                    <DatePicker
                        selection={pickerValue}
                        displayedComponents={
                            mode === 'datetime' ? ['date', 'hourAndMinute'] : ['date']
                        }
                        range={
                            minimumDate || maximumDate
                                ? { start: minimumDate, end: maximumDate }
                                : undefined
                        }
                        onDateChange={onChange}
                        modifiers={[
                            labelsHidden(),
                            datePickerStyle('compact'),
                            tint(theme.colors.primary as string),
                            environment('locale', i18n.language),
                            environment('colorScheme', rt.themeName ?? 'light'),
                        ]}
                    />
                </Host>
            </HStack>
            {error?.message && (
                <Error containerStyle={styles.errorContainer}>
                    {t(error.message, { ns: 'common' })}
                </Error>
            )}
        </VStack>
    );
}
