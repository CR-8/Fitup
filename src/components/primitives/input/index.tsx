import { ForwardedRef, forwardRef } from 'react';
import { Platform, TextInput, TextInputProps } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';

export type InputProps = TextInputProps;

const Input = forwardRef<TextInput, InputProps>(({ ...rest }, ref: ForwardedRef<TextInput>) => {
    const { theme } = useUnistyles();

    return (
        <TextInput
            ref={ref}
            placeholderTextColor={Platform.select({
                ios: theme.colors.mutedTypography,
                default: theme.colors.neutral[400],
            })}
            selectionColor={Platform.select({ ios: theme.colors.primary, default: undefined })}
            {...rest}
        />
    );
});

Input.displayName = 'Input';

export { Input };
