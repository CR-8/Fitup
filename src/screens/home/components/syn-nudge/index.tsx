import { FC } from 'react';
import { router } from 'expo-router';
import { StyleSheet } from 'react-native-unistyles';

import { SynMark } from '@/components/brand/syn-mark';
import { HStack } from '@/components/primitives/hstack';
import { Pressable } from '@/components/primitives/pressable';
import { Text } from '@/components/primitives/text';
import { Icon } from '@/components/primitives/icon';

const styles = StyleSheet.create((theme) => ({
    container: {
        marginHorizontal: theme.space(4),
        alignItems: 'center',
        gap: theme.space(3),
        backgroundColor: theme.colors.foreground,
        borderRadius: theme.radius['2xl'],
        borderWidth: 1,
        borderColor: theme.colors.border,
        paddingHorizontal: theme.space(4),
        paddingVertical: theme.space(3.5),
    },
    text: {
        ...theme.fontSize.sm,
        flex: 1,
        color: theme.colors.typography,
    },
}));

/** One line from Syn, and the way into the Coach tab. */
export const SynNudge: FC<{ message: string }> = ({ message }) => (
    <Pressable
        onPress={() => router.navigate('/syn')}
        accessibilityRole="button"
        accessibilityLabel={message}
    >
        <HStack style={styles.container}>
            <SynMark size={24} />
            <Text style={styles.text} numberOfLines={2}>
                {message}
            </Text>
            <Icon name="chevron-right" size={16} />
        </HStack>
    </Pressable>
);
