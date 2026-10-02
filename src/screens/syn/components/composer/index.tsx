import { FC, useState } from 'react';
import { Platform } from 'react-native';
import { useKeyboard } from '@react-native-community/hooks';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';

import { HStack } from '@/components/primitives/hstack';
import { Box } from '@/components/primitives/box';
import { Input } from '@/components/primitives/input';
import { Pressable } from '@/components/primitives/pressable';
import Spinner from '@/components/feedback/spinner';
import { Icon } from '@/components/primitives/icon';

// Android's tab bar floats over the content, so the composer clears it itself.
const ANDROID_TAB_BAR = 16;

const styles = StyleSheet.create((theme, rt) => ({
    container: (keyboardShown: boolean) => ({
        paddingTop: theme.space(2),
        paddingBottom:
            Platform.OS === 'android' && !keyboardShown
                ? rt.insets.bottom + theme.space(ANDROID_TAB_BAR) + theme.space(2)
                : theme.space(2),
    }),
    // One rounded bar holding the field and its send button, as a messaging
    // app's: the input is flush inside it rather than a box beside a button.
    bar: {
        alignItems: 'flex-end',
        gap: theme.space(2),
        backgroundColor: theme.colors.foreground,
        borderRadius: theme.radius['3xl'],
        borderCurve: 'continuous',
        paddingLeft: theme.space(4),
        paddingRight: theme.space(1.5),
        paddingVertical: theme.space(1.5),
    },
    input: {
        flex: 1,
        minHeight: theme.space(9),
        maxHeight: theme.space(28),
        paddingVertical: theme.space(2),
        color: theme.colors.typography,
        ...theme.fontSize.default,
    },
    // iOS takes the coral of its primary buttons; Android keeps the pre-native
    // ink fill its primary actions use.
    send: {
        height: theme.space(9),
        width: theme.space(9),
        borderRadius: theme.radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Platform.select({
            ios: theme.colors.primary,
            default: rt.themeName === 'dark' ? theme.colors.white : theme.colors.neutral[950],
        }),
    },
    sendDisabled: {
        backgroundColor: theme.colors.elevated,
    },
}));

interface ComposerProps {
    onSend: (value: string) => void;
    disabled?: boolean;
    busy?: boolean;
}

export const Composer: FC<ComposerProps> = ({ onSend, disabled = false, busy = false }) => {
    const { t } = useTranslation('screens');
    const { theme, rt } = useUnistyles();
    const { keyboardShown } = useKeyboard();
    const [value, setValue] = useState('');

    const trimmed = value.trim();
    const canSend = trimmed.length > 0 && !disabled && !busy;

    const activeIconColor = Platform.select({
        ios: theme.solid.primaryTypography,
        default: rt.themeName === 'dark' ? theme.colors.neutral[950] : theme.colors.neutral[50],
    });

    const handleSend = () => {
        if (!canSend) return;
        onSend(trimmed);
        setValue('');
    };

    // On iOS the native tab bar is part of this view's safe area; while typing,
    // the keyboard sits over it instead.
    return (
        <SafeAreaView edges={Platform.OS === 'ios' && !keyboardShown ? ['bottom'] : []}>
            <Box style={styles.container(keyboardShown)}>
                <HStack style={styles.bar}>
                    <Input
                        style={styles.input}
                        value={value}
                        onChangeText={setValue}
                        placeholder={t('syn.composer.placeholder')}
                        multiline
                        editable={!disabled}
                    />

                    <Pressable
                        onPress={handleSend}
                        disabled={!canSend}
                        accessibilityRole="button"
                        accessibilityLabel={t('syn.composer.send')}
                    >
                        <Box style={[styles.send, !canSend && !busy && styles.sendDisabled]}>
                            {busy ? (
                                <Spinner size={theme.space(4.5)} color={activeIconColor} />
                            ) : (
                                <Icon
                                    name="arrow-up"
                                    size={theme.space(4.5)}
                                    color={canSend ? activeIconColor : theme.colors.mutedTypography}
                                />
                            )}
                        </Box>
                    </Pressable>
                </HStack>
            </Box>
        </SafeAreaView>
    );
};
