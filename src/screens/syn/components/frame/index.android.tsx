import { FC, PropsWithChildren } from 'react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { Undo2 } from 'lucide-react-native';

import { HStack } from '@/components/primitives/hstack';
import { VStack } from '@/components/primitives/vstack';
import { Pressable } from '@/components/primitives/pressable';
import { Title } from '@/components/typography/title';

export type SynFrameProps = PropsWithChildren<{
    canClear: boolean;
    onClear: () => void;
}>;

const styles = StyleSheet.create((theme) => ({
    container: {
        flex: 1,
        paddingHorizontal: theme.space(4),
    },
    header: {
        paddingTop: theme.screenHeaderHeight(),
        paddingBottom: theme.space(3),
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.space(3),
    },
    resetButton: {
        height: theme.space(8),
        width: theme.space(8),
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.foreground,
        borderRadius: theme.radius.lg,
    },
}));

/** The conversation under an in-page title row, which holds clearing it. */
export const SynFrame: FC<SynFrameProps> = ({ canClear, onClear, children }) => {
    const { t } = useTranslation('screens');
    const { theme } = useUnistyles();

    return (
        <VStack style={styles.container}>
            <HStack style={styles.header}>
                <Title type="h1">{t('syn.title')}</Title>

                {canClear ? (
                    <Pressable
                        style={styles.resetButton}
                        onPress={onClear}
                        accessibilityRole="button"
                        accessibilityLabel={t('syn.clear.title')}
                    >
                        <Undo2
                            size={theme.space(4)}
                            strokeWidth={theme.space(0.375)}
                            opacity={0.8}
                            color={theme.colors.typography}
                        />
                    </Pressable>
                ) : null}
            </HStack>

            {children}
        </VStack>
    );
};

/** Where Syn is unavailable: the content under the in-page title. */
export const UnavailableFrame: FC<PropsWithChildren> = ({ children }) => {
    const { t } = useTranslation('screens');

    return (
        <VStack style={styles.container}>
            <HStack style={styles.header}>
                <Title type="h1">{t('syn.title')}</Title>
            </HStack>
            {children}
        </VStack>
    );
};
