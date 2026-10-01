import { FC, ForwardedRef, forwardRef, ReactNode, useMemo, useState } from 'react';
import { KeyboardTypeOptions, StyleProp, TextInput, TextStyle } from 'react-native';
import { NumberFormatValues, NumericFormat } from 'react-number-format';
import { StyleSheet, UnistylesVariants } from 'react-native-unistyles';
import { useLocales } from 'expo-localization';

import { HStack } from '@/components/primitives/hstack';
import { Input as InputPrimitive } from '@/components/primitives/input';
import { VStack } from '@/components/primitives/vstack';
import { stableOutlineWidth } from '@/helpers/styles';
import { getNumericValue, valueToType } from '@/helpers/values';

import { FieldValueType, InputType, OnChangeType, TextEntryProps } from '../../types';
import { Label, Error, Help } from '../../components';
import { useTranslation } from 'react-i18next';

interface InputBaseProps extends InputType {
    onChange: OnChangeType;
}

export type InputProps = InputBaseProps & UnistylesVariants<typeof styles>;

interface InputContainerBaseProps extends Pick<InputType, 'error' | 'inputContainerStyle'> {
    children: ReactNode;
}

type InputContainerProps = InputContainerBaseProps & UnistylesVariants<typeof styles>;

interface InputComponentProps extends TextEntryProps {
    defaultValue?: string;
    inputValue?: string;
    valueType: FieldValueType;
    keyboardType?: KeyboardTypeOptions;
    decimalScale: number;
    decimalSeparator: string;
    thousandSeparator: string;
    style?: StyleProp<TextStyle>;
    onChangeNumeric: (values: NumberFormatValues) => void;
    onChangeHandler: (value: string) => void;
    onChangeText: (text: string) => void;
}

const styles = StyleSheet.create((theme) => ({
    // The system text-field look: a filled, softly rounded well, outlined only
    // when the value is rejected.
    inputContainer: (error: boolean) => ({
        alignItems: 'center',
        backgroundColor: theme.colors.input,
        borderRadius: theme.radius.xl,
        borderCurve: 'continuous',
        borderWidth: stableOutlineWidth,
        borderColor: error ? theme.colors.destructive : 'transparent',
        paddingHorizontal: theme.space(3),
        variants: {
            size: {
                xs: {
                    height: theme.space(9),
                },
                sm: {
                    height: theme.space(11),
                },
                default: {
                    height: theme.space(12),
                },
            },
        },
    }),
    input: (error: boolean) => ({
        height: '100%',
        width: '100%',
        color: error ? theme.colors.destructive : theme.colors.typography,
        fontSize: theme.fontSize.lg.fontSize,
    }),
}));

export const InputContainer: FC<InputContainerProps> = ({
    error,
    inputContainerStyle,
    size,
    children,
}) => {
    styles.useVariants({ size });

    return (
        <HStack style={[styles.inputContainer(!!error), inputContainerStyle]}>{children}</HStack>
    );
};

const InputComponent = forwardRef<TextInput, InputComponentProps>(
    (
        {
            defaultValue,
            inputValue,
            valueType,
            keyboardType,
            decimalScale,
            decimalSeparator,
            thousandSeparator,
            style,
            onChangeNumeric,
            onChangeHandler,
            onChangeText,
            onSubmitEditing,
            placeholder,
            onFocus,
            onBlur,
            secureTextEntry,
            autoCapitalize,
            autoComplete,
            autoCorrect,
            textContentType,
        }: InputComponentProps,
        ref: ForwardedRef<TextInput>,
    ) => {
        // Spread into both branches so a numeric field can still be masked.
        const entry = {
            secureTextEntry,
            autoCapitalize,
            autoComplete,
            autoCorrect,
            textContentType,
        };

        return (
            <>
                {['number', 'decimal'].includes(valueType) ? (
                    <NumericFormat
                        value={inputValue}
                        valueIsNumericString={true}
                        onValueChange={onChangeNumeric}
                        allowNegative={false}
                        decimalScale={decimalScale}
                        decimalSeparator={decimalSeparator}
                        thousandSeparator={thousandSeparator}
                        displayType={'text'}
                        renderText={(value) => (
                            <InputPrimitive
                                {...entry}
                                ref={ref}
                                value={value}
                                keyboardType={keyboardType}
                                onChangeText={onChangeHandler}
                                onSubmitEditing={onSubmitEditing}
                                onFocus={onFocus}
                                onBlur={onBlur}
                                style={style}
                                placeholder={placeholder}
                            />
                        )}
                    />
                ) : (
                    <InputPrimitive
                        {...entry}
                        ref={ref}
                        defaultValue={defaultValue}
                        keyboardType={keyboardType}
                        onChangeText={onChangeText}
                        onSubmitEditing={onSubmitEditing}
                        onFocus={onFocus}
                        onBlur={onBlur}
                        style={style}
                        placeholder={placeholder}
                    />
                )}
            </>
        );
    },
);

InputComponent.displayName = 'InputComponent';

const BaseInput = forwardRef(
    (
        {
            label,
            value,
            valueType = 'text',
            keyboardType,
            numericThousandSeparator,
            numericDecimalScale,
            error,
            help,
            inputContainerStyle,
            inputStyle,
            onChange,
            onSubmitEditing,
            placeholder,
            size,
            onFocus,
            onBlur,
            secureTextEntry,
            autoCapitalize,
            autoComplete,
            autoCorrect,
            textContentType,
        }: InputProps,
        ref: ForwardedRef<TextInput>,
    ) => {
        styles.useVariants({ size });

        const locale = useLocales();
        const { t } = useTranslation(['common']);

        const defaultValue = useMemo(() => {
            if (!value) {
                return undefined;
            }
            return String(value);
        }, [value]);

        const [inputValue, setInputValue] = useState<string | undefined>(defaultValue);

        const decimalSeparator = locale[0].decimalSeparator || '.';

        const thousandSeparator = useMemo(() => {
            if (numericThousandSeparator) {
                return numericThousandSeparator;
            }
            if (numericThousandSeparator === '') {
                return numericThousandSeparator;
            }
            return locale[0].digitGroupingSeparator || ' ';
        }, [locale, numericThousandSeparator]);

        const decimalScale = useMemo(() => {
            if (numericDecimalScale) {
                return numericDecimalScale;
            }
            if (valueType === 'decimal') {
                return 2;
            }
            return 0;
        }, [valueType, numericDecimalScale]);

        const onChangeText = (text: string) => {
            const value = valueToType(text, valueType);

            if (typeof value !== 'boolean') {
                if (!value && valueType === 'text') {
                    onChange(undefined);
                }
                if (!value && valueType === 'number') {
                    onChange(null);
                }
                if (!value && valueType === 'decimal') {
                    onChange(null);
                }

                if (value) {
                    onChange(value);
                }
            }
        };

        const onChangeNumeric = (values: NumberFormatValues) => {
            const numeric = getNumericValue(values.floatValue);
            onChange(numeric);
        };

        const onChangeHandler = (value: string) => {
            setInputValue(value);
        };

        const props = {
            defaultValue,
            inputValue,
            valueType,
            keyboardType,
            decimalScale,
            decimalSeparator,
            thousandSeparator,
            inputStyle,
            onChangeNumeric,
            onChangeHandler,
            onChangeText,
            onSubmitEditing,
            placeholder,
            onFocus,
            onBlur,
            secureTextEntry,
            autoCapitalize,
            autoComplete,
            autoCorrect,
            textContentType,
            style: [styles.input(!!error), inputStyle],
        };

        return (
            <VStack>
                {label && <Label>{label}</Label>}
                <InputContainer error={error} inputContainerStyle={inputContainerStyle} size={size}>
                    <InputComponent {...props} ref={ref} />
                </InputContainer>
                {error?.message && <Error>{t(error.message, { ns: 'common' })}</Error>}
                {help && !error && <Help>{help.message}</Help>}
            </VStack>
        );
    },
);

BaseInput.displayName = 'BaseInput';

export { BaseInput };
