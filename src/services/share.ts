import type { RefObject } from 'react';
import type { View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import Share from 'react-native-share';
import { File, Paths } from 'expo-file-system';

import { reportError } from './error-reporting';

/**
 * Shares a `ShareCard` as an image, with the message (which carries the join
 * link) beside it, in one share sheet.
 *
 * The card is rendered at Open Graph size (1200 × 630) and written to the
 * app's own cache, the one folder react-native-share's Android file provider
 * can hand to another app. If the picture cannot be made, the words still go.
 */
export const shareCard = async (card: RefObject<View | null> | View | null, message: string) => {
    let url: string | undefined;

    try {
        const base64 = await captureRef(card, {
            format: 'png',
            width: 1200,
            height: 630,
            result: 'base64',
            // The card sits off screen; iOS only draws it there through the layer.
            useRenderInContext: true,
        });
        const file = new File(Paths.cache, `fitsyn-share-${Date.now()}.png`);
        file.write(base64, { encoding: 'base64' });
        url = file.uri;
    } catch (error) {
        reportError(error, 'Failed to render a share card:');
    }

    await Share.open({
        message,
        ...(url ? { url, type: 'image/png' } : null),
        failOnCancel: false,
    });
};
