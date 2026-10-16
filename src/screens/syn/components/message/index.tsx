import { FC } from 'react';
import { StyleSheet } from 'react-native-unistyles';

import { HStack } from '@/components/primitives/hstack';
import { VStack } from '@/components/primitives/vstack';
import { Text } from '@/components/primitives/text';
import type { AiMessageSelect, AiPlanSelect } from '@/db/schema';

import { PlanCard } from '../plan-card';
import { SynAvatar } from '../avatar';

const styles = StyleSheet.create((theme) => ({
    row: {
        width: '100%',
    },
    userRow: {
        alignItems: 'flex-end',
    },
    assistantRow: {
        alignItems: 'flex-start',
    },
    // Syn's turns lead with its avatar, bottom-aligned like a messaging app.
    assistantLine: {
        alignItems: 'flex-end',
        gap: theme.space(2),
        maxWidth: '92%',
    },
    bubble: {
        maxWidth: '88%',
        borderRadius: theme.radius['2xl'],
        borderCurve: 'continuous',
        paddingHorizontal: theme.space(4),
        paddingVertical: theme.space(3),
    },
    // The user's own turn uses the app's primary fill, the same treatment as its
    // primary buttons, on both platforms.
    userBubble: {
        backgroundColor: theme.colors.brand[600],
        borderBottomRightRadius: theme.radius.sm,
    },
    userText: {
        ...theme.fontSize.default,
        color: theme.colors.white,
    },
    assistantText: {
        ...theme.fontSize.default,
        color: theme.colors.typography,
    },
    // A raised surface: on the page colour, as it was, the reply had no bubble
    // at all on the black ground.
    assistantBubble: {
        flexShrink: 1,
        maxWidth: '100%',
        backgroundColor: theme.colors.foreground,
        borderBottomLeftRadius: theme.radius.sm,
    },
    errorText: {
        ...theme.fontSize.default,
        color: theme.colors.destructive,
    },
    errorBubble: {
        borderLeftWidth: 3,
        borderLeftColor: theme.colors.destructive,
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

    if (message.role === 'user' && !message.errorCode) {
        return (
            <VStack style={[styles.row, styles.userRow]}>
                <VStack style={[styles.bubble, styles.userBubble]}>
                    <Text style={styles.userText}>{message.content}</Text>
                </VStack>
            </VStack>
        );
    }

    return (
        <VStack style={[styles.row, styles.assistantRow]}>
            <HStack style={styles.assistantLine}>
                <SynAvatar />
                <VStack
                    style={[
                        styles.bubble,
                        styles.assistantBubble,
                        message.errorCode ? styles.errorBubble : null,
                    ]}
                >
                    <Text style={message.errorCode ? styles.errorText : styles.assistantText}>
                        {message.content}
                    </Text>
                </VStack>
            </HStack>
        </VStack>
    );
};
