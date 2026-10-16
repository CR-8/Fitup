import * as Application from 'expo-application';
import * as Device from 'expo-device';
import * as MailComposer from 'expo-mail-composer';
import { Platform } from 'react-native';

import { SUPPORT_EMAIL } from '@/constants/contact';
import { supabase } from '@/services/supabase';
import { reportError } from '@/services/error-reporting';

export type FeedbackType = 'bug' | 'feature' | 'general';

export type FeedbackInput = {
    type: FeedbackType;
    message: string;
    /** Local file URI of a screenshot the person chose. */
    screenshotUri?: string | null;
    includeDevice: boolean;
    /** Subject line for the mail fallback. */
    subject: string;
};

/** What "Include device logs" sends: app version, OS and device. Never health data. */
export const getDeviceInfo = () => ({
    appVersion: Application.nativeApplicationVersion,
    build: Application.nativeBuildVersion,
    os: `${Platform.OS} ${Device.osVersion ?? Platform.Version}`,
    device: Device.modelName ?? null,
});

export type FeedbackResult = 'sent' | 'emailed' | 'cancelled';

const uploadScreenshot = async (userId: string, uri: string): Promise<string | null> => {
    if (!supabase) return null;

    const extension = uri.split('.').pop()?.toLowerCase().split('?')[0] ?? 'jpg';
    const path = `${userId}/${Date.now()}.${extension}`;
    const body = await (await fetch(uri)).arrayBuffer();
    const contentType =
        extension === 'png' ? 'image/png' : extension === 'webp' ? 'image/webp' : 'image/jpeg';

    const { error } = await supabase.storage
        .from('feedback-screenshots')
        .upload(path, body, { contentType });

    return error ? null : path;
};

/** The mail composer, used whenever the report cannot go to the backend. */
const sendByEmail = async (input: FeedbackInput): Promise<FeedbackResult> => {
    const device = input.includeDevice
        ? `\n\n---\n${Object.entries(getDeviceInfo())
              .map(([key, value]) => `${key}: ${value ?? ''}`)
              .join('\n')}`
        : '';

    const result = await MailComposer.composeAsync({
        recipients: [SUPPORT_EMAIL],
        subject: input.subject,
        body: `${input.message}${device}`,
        attachments: input.screenshotUri ? [input.screenshotUri] : [],
    });

    return result.status === 'sent' ? 'emailed' : 'cancelled';
};

/**
 * Sends a report to the `feedback` table (insert-only RLS, `0010_feedback.sql`),
 * and falls back to the mail composer when signed out, offline, or when the
 * table does not exist yet. A failure of the backend never loses the message.
 */
export const submitFeedback = async (
    input: FeedbackInput,
    userId: string | null,
): Promise<FeedbackResult> => {
    if (!supabase || !userId) return sendByEmail(input);

    try {
        const screenshotPath = input.screenshotUri
            ? await uploadScreenshot(userId, input.screenshotUri)
            : null;

        const { error } = await supabase.from('feedback').insert({
            user_id: userId,
            type: input.type,
            message: input.message,
            device: input.includeDevice ? getDeviceInfo() : null,
            screenshot_path: screenshotPath,
        });

        if (error) throw error;

        return 'sent';
    } catch (error) {
        reportError(error, 'Feedback submit failed; falling back to email');

        return sendByEmail(input);
    }
};
