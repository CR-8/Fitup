import { FC, useRef, useState } from 'react';
import { Image } from 'expo-image';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';

import { Box } from '@/components/primitives/box';
import { Icon } from '@/components/primitives/icon';
import { Pressable } from '@/components/primitives/pressable';
import { runInBackground } from '@/services/error-reporting';

/**
 * An exercise's demonstration as a small player: the animation on its white
 * plate (the ground the media is drawn on), looping, with a play/pause button
 * in the corner to hold a position and study it.
 */

const styles = StyleSheet.create((theme) => ({
    plate: {
        width: '100%',
        borderRadius: 22,
        borderCurve: 'continuous' as const,
        backgroundColor: theme.colors.white,
        overflow: 'hidden',
        padding: theme.space(3),
    },
    image: {
        width: '100%',
    },
    control: {
        position: 'absolute',
        right: theme.space(3),
        bottom: theme.space(3),
        height: 40,
        width: 40,
        borderRadius: theme.radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(8, 9, 11, 0.6)',
    },
}));

export const ExercisePlayer: FC<{ uri: string; title: string }> = ({ uri, title }) => {
    const { t } = useTranslation(['common']);
    const image = useRef<Image>(null);
    const [playing, setPlaying] = useState(true);
    const [aspectRatio, setAspectRatio] = useState(1);

    const toggle = () => {
        const next = !playing;
        setPlaying(next);
        runInBackground(
            () => (next ? image.current?.startAnimating() : image.current?.stopAnimating()),
            'Failed to play or pause an exercise animation:',
        );
    };

    return (
        <Box style={styles.plate}>
            <Image
                ref={image}
                source={{ uri }}
                style={[styles.image, { aspectRatio }]}
                contentFit="contain"
                autoplay
                accessibilityLabel={title}
                onLoad={(event) => setAspectRatio(event.source.width / event.source.height)}
            />
            <Pressable
                style={styles.control}
                onPress={toggle}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t(playing ? 'pause' : 'play', { ns: 'common' })}
            >
                <Icon name={playing ? 'pause' : 'play'} size={16} color="#ffffff" />
            </Pressable>
        </Box>
    );
};
