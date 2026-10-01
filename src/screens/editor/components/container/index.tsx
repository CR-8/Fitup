import { FC, ReactNode } from 'react';
import { ActivityIndicator } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';

import { Stack } from '@/navigators/stack';
import { VStack } from '@/components/primitives/vstack';
import { ScrollView } from '@/components/primitives/scrollview';
import { Text } from '@/components/primitives/text';
import { HeaderTextButton } from '@/components/buttons/header';

interface ContainerProps {
    title?: string | null;
    description?: string | null;
    loading?: boolean;
    submitDisabled?: boolean;
    buttonHidden?: boolean;
    handleSubmit: () => void;
    handleClose: () => void;
    buttonLabel?: string;
    children: ReactNode;
}

const styles = StyleSheet.create((theme) => ({
    scroll: {
        flexGrow: 1,
        gap: theme.space(3),
        ...theme.screenContentPadding('child'),
    },
    content: {
        flex: 1,
        gap: theme.space(3),
    },
    description: {
        ...theme.fontSize.default,
        color: theme.colors.mutedTypography,
        paddingHorizontal: theme.space(4),
    },
}));

/**
 * The editors' modal: title in the native header, Cancel on the leading side,
 * the confirming action on the trailing side.
 */
const Container: FC<ContainerProps> = ({
    title,
    description,
    loading,
    submitDisabled,
    buttonHidden,
    handleSubmit,
    handleClose,
    buttonLabel,
    children,
}) => {
    const { t } = useTranslation(['common']);
    const { theme } = useUnistyles();

    return (
        <>
            <Stack.Screen
                options={{
                    title: title ?? '',
                    headerLeft: () => (
                        <HeaderTextButton
                            title={t('cancel', { ns: 'common' })}
                            onPress={handleClose}
                        />
                    ),
                    headerRight: buttonHidden
                        ? undefined
                        : () =>
                              loading ? (
                                  <ActivityIndicator color={theme.colors.primary} />
                              ) : (
                                  <HeaderTextButton
                                      title={buttonLabel ?? t('save', { ns: 'common' })}
                                      onPress={handleSubmit}
                                      disabled={submitDisabled}
                                      prominent
                                  />
                              ),
                }}
            />
            <ScrollView
                automaticallyAdjustKeyboardInsets
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
                contentContainerStyle={styles.scroll}
            >
                {description ? <Text style={styles.description}>{description}</Text> : null}
                <VStack style={styles.content}>{children}</VStack>
            </ScrollView>
        </>
    );
};

export { Container };
