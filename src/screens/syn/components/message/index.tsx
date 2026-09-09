import { FC } from 'react';
import { StyleSheet } from 'react-native-unistyles';

import { VStack } from '@/components/primitives/vstack';
import { Text } from '@/components/primitives/text';
import type { AiMessageSelect, AiPlanSelect } from '@/db/schema';

import { PlanCard } from '../plan-card';

const styles = StyleSheet.create((theme, rt) => ({
    row: {
        width: '100%',
    },
    userRow: {
        alignItems: 'flex-end',
    },
    assistantRow: {
        alignItems: 'flex-start',
    },
    bubble: {
        maxWidth: '88%',
        borderRadius: theme.radius['2xl'],
        paddingHorizontal: theme.space(4),
        paddingVertical: theme.space(3),
    },
    // The user's own turn uses the app's primary fill, the same treatment as its
    // primary buttons, so the thread reads with the rest of the interface.
    userBubble: {
        backgroundColor: rt.themeName === 'dark' ? theme.colors.white : theme.colors.neutral[950],
        borderBottomRightRadius: theme.radius.sm,
    },
    userText: {
        color: rt.themeName === 'dark' ? theme.colors.neutral[950] : theme.colors.neutral[50],
    },
    assistantBubble: {
        backgroundColor: theme.colors.background,
        borderBottomLeftRadius: theme.radius.sm,
    },
    errorBubble: {
        backgroundColor: theme.colors.background,
    },
    errorText: {
        color: theme.colors.red[400],
    },
    planWrapper: {
        width: '100%',
    },
}));

interface MessageProps {
    message: AiMessageSelect;
    plan?: AiPlanSelect;
}

export const Message: FC<MessageProps> = ({ message, plan }) => {
    if (plan) {
        return (
            <VStack style={[styles.row, styles.assistantRow]}>
                <VStack style={styles.planWrapper}>
                    <PlanCard plan={plan} />
                </VStack>
            </VStack>
        );
    }

    if (message.errorCode) {
        return (
            <VStack style={[styles.row, styles.assistantRow]}>
                <VStack style={[styles.bubble, styles.errorBubble]}>
                    <Text fontSize="sm" style={styles.errorText}>
                        {message.content}
                    </Text>
                </VStack>
            </VStack>
        );
    }

    const isUser = message.role === 'user';

    return (
        <VStack style={[styles.row, isUser ? styles.userRow : styles.assistantRow]}>
            <VStack style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}>
                <Text fontSize="sm" style={isUser ? styles.userText : undefined}>
                    {message.content}
                </Text>
            </VStack>
        </VStack>
    );
};
