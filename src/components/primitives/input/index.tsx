import { ForwardedRef, forwardRef } from 'react';
import { TextInput, TextInputProps } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';

export type InputProps = TextInputProps;

const Input = forwardRef<TextInput, InputProps>(({ ...rest }, ref: ForwardedRef<TextInput>) => {
    const { theme } = useUnistyles();

    return (
        <TextInput
            ref={ref}
            placeholderTextColor={theme.colors.mutedTypography}
            selectionColor={theme.colors.primary}
            {...rest}
        />
    );
});

Input.displayName = 'Input';

export { Input };
