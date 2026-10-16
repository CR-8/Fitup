import { FC, useEffect } from 'react';
import { Platform } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';

import { HStack } from '@/components/primitives/hstack';
import { Pressable } from '@/components/primitives/pressable';
import { Text } from '@/components/primitives/text';
import { useUndoToastStore } from '@/stores/undo-toast';

const VISIBLE_MS = 10_000;

const styles = StyleSheet.create((theme, rt) => ({
    container: {
        position: 'absolute',
        left: theme.space(4),
        right: theme.space(4),
        // Clears the tab bar: the floating one on iOS, the pinned one on Android.
        bottom: rt.insets.bottom + theme.space(Platform.OS === 'ios' ? 20 : 22),
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.space(3),
        backgroundColor: theme.colors.elevated,
        borderRadius: theme.radius['2xl'],
        borderWidth: 1,
        borderColor: theme.colors.border,
        paddingLeft: theme.space(4),
        paddingRight: theme.space(2),
        paddingVertical: theme.space(1),
        zIndex: 2000,
    },
    message: {
        ...theme.fontSize.sm,
        flex: 1,
        color: theme.colors.typography,
    },
    action: {
        minHeight: 44,
        minWidth: 64,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: theme.space(3),
    },
    actionText: {
        ...theme.fontSize.default,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: theme.colors.brand[400],
    },
}));

/**
 * "Added 3 changes to your plan. Undo", for ten seconds. One at a time; a new
 * action replaces the last. No animation, so it needs no Reduce Motion branch.
 */
export const UndoToast: FC = () => {
    const { t } = useTranslation('screens');
    const toast = useUndoToastStore((state) => state.toast);
    const dismiss = useUndoToastStore((state) => state.dismiss);

    useEffect(() => {
        if (!toast) return;

        const timeout = setTimeout(dismiss, VISIBLE_MS);

        return () => clearTimeout(timeout);
    }, [dismiss, toast]);

    if (!toast) return null;

    return (
        <HStack style={styles.container} accessibilityLiveRegion="polite">
            <Text style={styles.message} numberOfLines={2}>
                {toast.message}
            </Text>
            <Pressable
                style={styles.action}
                onPress={() => {
                    dismiss();
                    toast.onUndo();
                }}
                accessibilityRole="button"
            >
                <Text style={styles.actionText}>{t('syn.preview.undo')}</Text>
            </Pressable>
        </HStack>
    );
};
