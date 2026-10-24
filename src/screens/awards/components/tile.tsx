import { FC } from 'react';
import { router } from 'expo-router';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';

import { Box } from '@/components/primitives/box';
import { Pressable } from '@/components/primitives/pressable';
import { Text } from '@/components/primitives/text';
import { ACCENT } from '@/screens/home/summary';

import { useAwardText, type Award } from '../data';
import { Medal, ProgressLine } from './badge';

export const openAward = (award: Award) =>
    router.navigate({ pathname: '/award/[awardId]', params: { awardId: award.id } } as never);

const styles = StyleSheet.create((theme) => ({
    tile: {
        width: '33.33%',
        alignItems: 'center',
        gap: theme.space(1),
        paddingHorizontal: theme.space(1),
        paddingBottom: theme.space(4),
    },
    name: {
        ...theme.fontSize.sm,
        textAlign: 'center',
        color: theme.colors.typography,
    },
    detail: {
        ...theme.fontSize.xs,
        textAlign: 'center',
        color: theme.colors.mutedTypography,
    },
    progress: {
        alignSelf: 'stretch',
        marginTop: theme.space(1),
    },
}));

/** Earned for its period, or at some point before (a daily award earned yesterday still shows struck). */
export const isWon = (award: Award) => award.earned || !!award.lastEarnedAt;

/**
 * A medal over its name and, once earned, the day it was; until then how far
 * along it is. Today's shelf in a grid, a third of the row wide; it opens the award.
 */
export const AwardTile: FC<{ award: Award; size: number; progress?: boolean }> = ({
    award,
    size,
    progress,
}) => {
    const { i18n } = useTranslation();
    const text = useAwardText();
    const earned = isWon(award);

    return (
        <Pressable
            style={styles.tile}
            onPress={() => openAward(award)}
            accessibilityRole="button"
            accessibilityLabel={`${text.name(award)}, ${text.detail(award)}`}
        >
            <Medal {...award} earned={earned} size={size} />
            <Text style={styles.name} numberOfLines={1}>
                {text.name(award)}
            </Text>
            <Text style={styles.detail} numberOfLines={1}>
                {earned
                    ? dayjs(award.lastEarnedAt ?? undefined)
                          .locale(i18n.language)
                          .format('D MMM YYYY')
                    : text.detail(award)}
            </Text>
            {progress ? (
                <Box style={styles.progress}>
                    <ProgressLine progress={award.progress} color={ACCENT.distance} />
                </Box>
            ) : null}
        </Pressable>
    );
};
