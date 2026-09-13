import { createElement } from 'react';
import { FieldPath, FieldValues, PathValue, useController } from 'react-hook-form';

import { BaseInput } from '../base/input';
import { SheetInput } from '../sheet/input';
import type { InputType as InputBaseType, ControlledInputType, InputValueType } from '../types';

type InputType<
    T extends FieldValues = FieldValues,
    TName extends FieldPath<T> = FieldPath<T>,
> = Omit<InputBaseType, 'value'> &
    ControlledInputType<T, TName> & {
        value?: PathValue<T, TName>;
    };

function Input<T extends FieldValues, TName extends FieldPath<T>>({
    control,
    label,
    name,
    value: defaultValue,
    valueType,
    keyboardType,
    error,
    help,
    inputContainerStyle,
    inputStyle,
    asSheet,
    prefix,
    suffix,
    numericThousandSeparator,
    placeholder,
    secureTextEntry,
    autoCapitalize,
    autoComplete,
    autoCorrect,
    textContentType,
}: InputType<T, TName>) {
    const {
        field: { onChange, value },
    } = useController({ name, control, defaultValue });

    return createElement(asSheet ? SheetInput : BaseInput, {
        /**
         * Keyed by field, because `BaseInput` seeds its displayed text once on
         * mount — local state for the numeric fields, `defaultValue` on a React
         * Native `TextInput` for the text ones, neither of which re-reads its
         * prop afterwards.
         *
         * Without this, a screen that renders different questions at the same
         * position in the tree has React reuse one instance for both, and the
         * second question inherits the first one's text. Onboarding did exactly
         * that: age and height are both the second field of their step, so an
         * age of 21 came back as a height of 21, and a target weight of 126 came
         * back as 126 sessions a week.
         */
        key: name,
        label,
        value: value as InputValueType,
        valueType,
        keyboardType,
        error,
        help,
        inputContainerStyle,
        inputStyle,
        onChange,
        prefix,
        suffix,
        asSheet,
        title: label,
        numericThousandSeparator,
        placeholder,
        secureTextEntry,
        autoCapitalize,
        autoComplete,
        autoCorrect,
        textContentType,
    });
}

export { Input };
