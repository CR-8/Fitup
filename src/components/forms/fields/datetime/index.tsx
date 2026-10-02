import { useMemo } from 'react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { DateTimePicker, type DateTimePickerEvent } from '@expo/ui/community/datetime-picker';
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
import { useUser } from '@/hooks/use-user';

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
    selectContainer: {
        alignItems: 'center',
        gap: theme.space(2),
    },
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
    const { user } = useUser();

    const {
        field: { onChange, value },
    } = useController({ name, control, defaultValue });

    const pickerValue = useMemo(
        () => (value ?? defaultValue ?? new Date()) as Date,
        [defaultValue, value],
    );

    const mergeDate = (base: Date, selectedDate: Date) => {
        const next = new Date(base);
        next.setFullYear(
            selectedDate.getFullYear(),
            selectedDate.getMonth(),
            selectedDate.getDate(),
        );

        return next;
    };

    const mergeTime = (base: Date, selectedTime: Date) => {
        const next = new Date(base);
        next.setHours(selectedTime.getHours(), selectedTime.getMinutes(), 0, 0);

        return next;
    };

    const handleDateChange = (event: DateTimePickerEvent, selected: Date | undefined) => {
        if (event.type === 'set') {
            if (!selected) {
                return;
            }

            onChange(mergeDate(pickerValue, selected));
        }
    };

    const handleTimeChange = (event: DateTimePickerEvent, selected: Date | undefined) => {
        if (event.type === 'set') {
            if (!selected) {
                return;
            }

            onChange(mergeTime(pickerValue, selected));
        }
    };

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
                <HStack style={styles.selectContainer}>
                    <DateTimePicker
                        value={pickerValue}
                        mode="date"
                        locale={i18n.language}
                        display="default"
                        minimumDate={minimumDate}
                        maximumDate={maximumDate}
                        onChange={handleDateChange}
                        themeVariant={rt.themeName}
                        accentColor={theme.colors.primary as string}
                    />
                    {mode === 'datetime' && (
                        <DateTimePicker
                            value={pickerValue}
                            mode="time"
                            locale={i18n.language}
                            display="default"
                            is24Hour={user?.timeFormat === '24h'}
                            onChange={handleTimeChange}
                            themeVariant={rt.themeName}
                            accentColor={theme.colors.primary as string}
                        />
                    )}
                </HStack>
            </HStack>
            {error?.message && (
                <Error containerStyle={styles.errorContainer}>
                    {t(error.message, { ns: 'common' })}
                </Error>
            )}
        </VStack>
    );
}
