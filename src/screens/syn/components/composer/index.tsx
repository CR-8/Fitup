import { FC, useState } from 'react';
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

const styles = StyleSheet.create((theme) => ({
    container: {
        paddingTop: theme.space(2),
        paddingBottom: theme.space(2),
        gap: theme.space(2),
        alignItems: 'flex-end',
    },
    input: {
        flex: 1,
        minHeight: theme.space(11),
        maxHeight: theme.space(28),
        backgroundColor: theme.colors.foreground,
        borderRadius: theme.radius['2xl'],
        paddingHorizontal: theme.space(4),
        paddingVertical: theme.space(3),
        color: theme.colors.typography,
        ...theme.fontSize.sm,
    },
    // Matches the primary button treatment used by CreateButton and Button.
    send: {
        height: theme.space(11),
        width: theme.space(11),
        borderRadius: theme.radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.primary,
    },
    sendDisabled: {
        backgroundColor: theme.colors.foreground,
    },
}));

interface ComposerProps {
    onSend: (value: string) => void;
    disabled?: boolean;
    busy?: boolean;
}

export const Composer: FC<ComposerProps> = ({ onSend, disabled = false, busy = false }) => {
    const { t } = useTranslation('screens');
    const { theme } = useUnistyles();
    const { keyboardShown } = useKeyboard();
    const [value, setValue] = useState('');

    const trimmed = value.trim();
    const canSend = trimmed.length > 0 && !disabled && !busy;

    const activeIconColor = theme.colors.primaryTypography;

    const handleSend = () => {
        if (!canSend) return;
        onSend(trimmed);
        setValue('');
    };

    // The native tab bar is part of this view's safe area; while typing, the
    // keyboard sits over it instead.
    return (
        <SafeAreaView edges={keyboardShown ? [] : ['bottom']}>
            <HStack style={styles.container}>
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
                    <Box style={[styles.send, !canSend && styles.sendDisabled]}>
                        {busy ? (
                            <Spinner size={theme.space(5)} color={activeIconColor} />
                        ) : (
                            <Icon
                                name="arrow-up"
                                size={theme.space(5)}
                                color={canSend ? activeIconColor : theme.colors.neutral[400]}
                            />
                        )}
                    </Box>
                </Pressable>
            </HStack>
        </SafeAreaView>
    );
};
