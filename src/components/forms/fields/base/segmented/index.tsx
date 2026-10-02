import { StyleSheet } from 'react-native-unistyles';
import {
    FieldError,
    FieldPath,
    FieldValues,
    Merge,
    PathValue,
    useController,
} from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { SegmentedControl } from '@expo/ui/community/segmented-control';

import { HStack } from '@/components/primitives/hstack';
import { VStack } from '@/components/primitives/vstack';
import { BoxProps } from '@/components/primitives/box';
import { Text } from '@/components/primitives/text';

import { ControlledInputType } from '../../types';
import { Error } from '../../components';

interface SegmentedType<
    T extends FieldValues = FieldValues,
    TName extends FieldPath<T> = FieldPath<T>,
> extends ControlledInputType<T, TName> {
    segments: {
        value: string;
        title: string;
        description?: string;
    }[];
    title: string;
    description?: string;
    selectedIndex?: number;
    error?: Merge<FieldError, (FieldError | undefined)[]> | undefined;
    containerStyle?: BoxProps['style'];
}

const styles = StyleSheet.create((theme) => ({
    container: {
        paddingVertical: theme.space(3),
        paddingHorizontal: theme.space(4),
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: theme.space(3),
    },
    title: (error: boolean) => ({
        flexShrink: 1,
        color: error ? theme.colors.destructive : theme.colors.typography,
    }),
    control: {
        minWidth: theme.space(30),
    },
    errorContainer: {
        paddingHorizontal: theme.space(4),
        marginTop: -theme.space(2),
        marginBottom: theme.space(3),
    },
}));

/** A titled row with the platform's segmented control (UISegmentedControl). */
function Segmented<T extends FieldValues, TName extends FieldPath<T>>({
    name,
    control,
    segments,
    title,
    error,
    selectedIndex = 0,
    containerStyle,
}: SegmentedType<T, TName>) {
    const { t } = useTranslation(['common']);

    const {
        field: { onChange, value },
    } = useController({
        name,
        control,
        defaultValue: segments[selectedIndex]?.value as PathValue<T, TName>,
    });

    const currentIndex = segments.findIndex((segment) => segment.value === value);

    return (
        <VStack>
            <HStack style={[styles.container, containerStyle]}>
                <Text style={styles.title(!!error)}>{title}</Text>
                <SegmentedControl
                    style={styles.control}
                    values={segments.map((segment) => segment.title)}
                    selectedIndex={currentIndex >= 0 ? currentIndex : selectedIndex}
                    onChange={({ nativeEvent }) =>
                        onChange(segments[nativeEvent.selectedSegmentIndex].value)
                    }
                />
            </HStack>
            {error?.message && (
                <Error containerStyle={styles.errorContainer}>
                    {t(error.message, { ns: 'common' })}
                </Error>
            )}
        </VStack>
    );
}

export { Segmented };
