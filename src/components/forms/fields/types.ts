import { TextInputProps, KeyboardTypeOptions } from 'react-native';
import { Control, FieldError, FieldPath, FieldValues, Merge } from 'react-hook-form';

import { BoxProps } from '@/components/primitives/box';
import { InputProps } from '@/components/primitives/input';

export type FieldValueType = 'text' | 'number' | 'decimal';

export type InputValueType = string | number | null;

export type OnChangeType = (value?: string | number | null) => void;

/**
 * Text-entry props forwarded to the underlying TextInput.
 *
 * An explicit list rather than all of TextInputProps, so a field cannot accept a
 * prop the component chain never passes on. Named and shared because the public
 * field type and the internal component props must stay identical — duplicating
 * the list is how one of them silently stops forwarding something.
 *
 * The autofill trio — secureTextEntry, autoComplete, textContentType — is what
 * lets a password manager fill and save. Without them a password renders in
 * plain text and no manager can touch it.
 */
export type TextEntryProps = Pick<
    TextInputProps,
    | 'onSubmitEditing'
    | 'placeholder'
    | 'onFocus'
    | 'onBlur'
    | 'secureTextEntry'
    | 'autoCapitalize'
    | 'autoComplete'
    | 'autoCorrect'
    | 'textContentType'
>;

export interface InputType extends TextEntryProps {
    label?: string;
    value?: InputValueType;
    valueType?: FieldValueType;
    keyboardType?: KeyboardTypeOptions;
    numericThousandSeparator?: string;
    numericDecimalScale?: number;
    error?: Merge<FieldError, (FieldError | undefined)[]> | undefined;
    help?: {
        message: string;
    };
    inputContainerStyle?: BoxProps['style'];
    inputStyle?: InputProps['style'];
    asSheet?: boolean;
    prefix?: string;
    suffix?: string;
}

export interface ControlledInputType<
    T extends FieldValues = FieldValues,
    TName extends FieldPath<T> = FieldPath<T>,
> {
    control: Control<T>;
    name: TName;
}
