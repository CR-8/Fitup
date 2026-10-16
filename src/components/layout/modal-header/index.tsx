import { FC } from 'react';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';

import { Text } from '@/components/primitives/text';
import { Stack } from '@/navigators/stack';
import { HeaderTextButton } from '@/components/buttons/header';

/**
 * A modal or pushed screen's header on iOS: the native bar's title, and Done
 * for a modal. Android draws its own in `index.android.tsx` with the same props.
 */

export const modalStyles = StyleSheet.create((theme) => ({
    /** Scroll content under the native bar, which insets it itself. */
    content: {
        ...theme.screenContentPadding('child'),
        paddingHorizontal: theme.space(4),
        gap: theme.space(4),
    },
}));

const styles = StyleSheet.create((theme) => ({
    subtitle: {
        ...theme.fontSize.sm,
        color: theme.colors.mutedTypography,
    },
}));

interface ModalHeaderProps {
    title: string;
    subtitle?: string;
    /** False on a pushed screen, which has the platform back button instead. */
    done?: boolean;
}

export const ModalHeader: FC<ModalHeaderProps> = ({ title, subtitle, done = true }) => {
    const { t } = useTranslation(['common']);

    return (
        <>
            <Stack.Screen
                options={{
                    title,
                    headerRight: done
                        ? () => (
                              <HeaderTextButton
                                  title={t('done', { ns: 'common' })}
                                  onPress={() => router.back()}
                                  prominent
                              />
                          )
                        : undefined,
                }}
            />
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </>
    );
};
