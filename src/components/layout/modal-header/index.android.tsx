import { FC, ReactNode } from 'react';
import { StyleSheet } from 'react-native-unistyles';
import { router } from 'expo-router';

import { HStack } from '@/components/primitives/hstack';
import { VStack } from '@/components/primitives/vstack';
import { Text } from '@/components/primitives/text';
import { Title } from '@/components/typography/title';
import { BackButton } from '@/components/buttons/back';

/**
 * Android: the modal slides up as a card with no navigation header, so the
 * screen draws its own back button and large title, as Nutrition does.
 */

export const modalStyles = StyleSheet.create((theme, rt) => ({
    content: {
        paddingTop: rt.insets.top + theme.space(2),
        paddingBottom: theme.screenContentPadding('root').paddingBottom,
        paddingHorizontal: theme.space(4),
        gap: theme.space(4),
    },
}));

const styles = StyleSheet.create((theme) => ({
    topRow: {
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    header: {
        gap: theme.space(1),
    },
    subtitle: {
        ...theme.fontSize.sm,
        color: theme.colors.mutedTypography,
    },
}));

interface ModalHeaderProps {
    title: string;
    subtitle?: string;
    /** iOS only (Done in the native bar); Android always draws its back button. */
    done?: boolean;
    /** A trailing button beside the back button. */
    right?: ReactNode;
}

export const ModalHeader: FC<ModalHeaderProps> = ({ title, subtitle, right }) => (
    <>
        <HStack style={styles.topRow}>
            <BackButton onPressHandler={() => router.back()} />
            {right}
        </HStack>

        <VStack style={styles.header}>
            <Title type="h1" accessibilityRole="header">
                {title}
            </Title>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </VStack>
    </>
);
