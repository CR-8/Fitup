import { FC, PropsWithChildren } from 'react';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';

import { VStack } from '@/components/primitives/vstack';
import { Stack } from '@/navigators/stack';
import { HeaderButton } from '@/components/buttons/header';

export type SynFrameProps = PropsWithChildren<{
    canClear: boolean;
    onClear: () => void;
}>;

const styles = StyleSheet.create((theme) => ({
    container: {
        flex: 1,
        paddingHorizontal: theme.space(4),
    },
    unavailable: {
        paddingTop: theme.space(2),
    },
}));

/** The conversation under the native header, which holds clearing it. */
export const SynFrame: FC<SynFrameProps> = ({ canClear, onClear, children }) => {
    const { t } = useTranslation('screens');

    return (
        // `automaticOffset` measures where the view really sits: below the native
        // header, which a plain offset of zero missed, leaving the composer under
        // the keyboard.
        <KeyboardAvoidingView behavior="padding" automaticOffset style={styles.container}>
            {/* A conversation, so an inline title as in Messages rather than a
                large one, with clearing it in the header. */}
            <Stack.Screen
                options={{
                    headerLargeTitle: false,
                    headerRight: canClear
                        ? () => (
                              <HeaderButton
                                  icon="undo"
                                  onPress={onClear}
                                  accessibilityLabel={t('syn.clear.title')}
                              />
                          )
                        : undefined,
                }}
            />
            {children}
        </KeyboardAvoidingView>
    );
};

/** Where Syn is unavailable: the content under the screen's native title. */
export const UnavailableFrame: FC<PropsWithChildren> = ({ children }) => (
    <VStack style={[styles.container, styles.unavailable]}>{children}</VStack>
);
