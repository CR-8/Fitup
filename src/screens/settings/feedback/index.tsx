import { useState } from 'react';
import { Alert, Switch, TextInput } from 'react-native';
import { router } from 'expo-router';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';

import { ScrollView } from '@/components/primitives/scrollview';
import { VStack } from '@/components/primitives/vstack';
import { HStack } from '@/components/primitives/hstack';
import { Text } from '@/components/primitives/text';
import { Pressable } from '@/components/primitives/pressable';
import { Icon } from '@/components/primitives/icon';
import { Button } from '@/components/buttons/base';
import { SegmentedTabs } from '@/components/forms/segmented-tabs';
import { useAccount } from '@/hooks/use-account';
import { reportError } from '@/services/error-reporting';
import { submitFeedback, type FeedbackType } from '@/services/feedback';

const styles = StyleSheet.create((theme) => ({
    container: {
        flex: 1,
        paddingHorizontal: theme.space(4),
    },
    content: {
        ...theme.screenContentPadding('child'),
        gap: theme.space(4),
    },
    message: {
        minHeight: theme.space(36),
        backgroundColor: theme.colors.foreground,
        borderRadius: theme.radius['4xl'],
        borderCurve: 'continuous',
        borderWidth: 1,
        borderColor: theme.colors.border,
        padding: theme.space(4),
        color: theme.colors.typography,
        textAlignVertical: 'top',
        ...theme.fontSize.default,
    },
    row: {
        alignItems: 'center',
        gap: theme.space(3),
        minHeight: theme.space(12),
    },
    rowLabel: {
        ...theme.fontSize.default,
        flex: 1,
        color: theme.colors.typography,
    },
    attach: {
        height: theme.space(12),
        width: theme.space(12),
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.foreground,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    thumb: {
        height: '100%',
        width: '100%',
    },
}));

const TYPES: readonly FeedbackType[] = ['bug', 'feature', 'general'];

/**
 * Send feedback: a type, a message, an optional screenshot, and a switch for
 * device details (app version, OS, device; never health data). It goes to the
 * backend when it can and to the mail composer when it cannot.
 */
const FeedbackScreen = () => {
    const { t } = useTranslation('screens');
    const { theme } = useUnistyles();
    const { session } = useAccount();
    const [type, setType] = useState<FeedbackType>('bug');
    const [message, setMessage] = useState('');
    const [screenshot, setScreenshot] = useState<string | null>(null);
    const [includeDevice, setIncludeDevice] = useState(true);
    const [sending, setSending] = useState(false);

    const pickScreenshot = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                quality: 0.7,
            });

            if (!result.canceled) setScreenshot(result.assets[0]?.uri ?? null);
        } catch (error) {
            reportError(error, 'Failed to pick a feedback screenshot');
        }
    };

    const send = async () => {
        if (!message.trim() || sending) return;

        setSending(true);
        try {
            const result = await submitFeedback(
                {
                    type,
                    message: message.trim(),
                    screenshotUri: screenshot,
                    includeDevice,
                    subject: t(`feedback.subject.${type}`),
                },
                session?.user.id ?? null,
            );

            if (result === 'sent') Alert.alert(t('feedback.thanks'));
            if (result !== 'cancelled') router.back();
        } finally {
            setSending(false);
        }
    };

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
        >
            <SegmentedTabs
                value={type}
                onChange={setType}
                segments={TYPES.map((value) => ({ value, title: t(`feedback.types.${value}`) }))}
                accessibilityLabel={t('feedback.type')}
            />

            <TextInput
                style={styles.message}
                value={message}
                onChangeText={setMessage}
                multiline
                maxLength={4000}
                placeholder={t('feedback.placeholder')}
                placeholderTextColor={theme.colors.mutedTypography as string}
                accessibilityLabel={t('feedback.message')}
                selectionColor={theme.colors.brand[500] as string}
            />

            <HStack style={styles.row}>
                <Pressable
                    style={styles.attach}
                    onPress={() => void pickScreenshot()}
                    accessibilityRole="button"
                    accessibilityLabel={t('feedback.addScreenshot')}
                >
                    {screenshot ? (
                        <Image source={{ uri: screenshot }} style={styles.thumb} />
                    ) : (
                        <Icon name="plus" size={theme.space(5)} />
                    )}
                </Pressable>
                <Text style={styles.rowLabel}>{t('feedback.addScreenshot')}</Text>
                {screenshot ? (
                    <Pressable
                        onPress={() => setScreenshot(null)}
                        accessibilityRole="button"
                        accessibilityLabel={t('feedback.removeScreenshot')}
                    >
                        <Text fontSize="sm" style={{ color: theme.colors.brand[400] }}>
                            {t('feedback.removeScreenshot')}
                        </Text>
                    </Pressable>
                ) : null}
            </HStack>

            <HStack style={styles.row}>
                <VStack style={{ flex: 1 }}>
                    <Text style={styles.rowLabel}>{t('feedback.includeDevice')}</Text>
                    <Text fontSize="sm" style={{ color: theme.colors.mutedTypography }}>
                        {t('feedback.deviceHint')}
                    </Text>
                </VStack>
                <Switch
                    value={includeDevice}
                    onValueChange={setIncludeDevice}
                    trackColor={{ true: theme.colors.brand[500] as string }}
                    accessibilityLabel={t('feedback.includeDevice')}
                />
            </HStack>

            <Button
                type="primary"
                title={t('feedback.submit')}
                disabled={!message.trim()}
                loading={sending}
                onPress={() => void send()}
                spinnerColor={theme.solid.primaryTypography}
            />
        </ScrollView>
    );
};

export default FeedbackScreen;
