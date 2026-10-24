import { FC, useRef } from 'react';
import type { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';

import { ScrollView } from '@/components/primitives/scrollview';
import { Box } from '@/components/primitives/box';
import { Text } from '@/components/primitives/text';
import { HeaderButton } from '@/components/buttons/header';
import { ShareCard } from '@/components/brand/share-card';
import { JOIN_URL } from '@/constants/contact';
import { ModalHeader, modalStyles } from '@/components/layout/modal-header';
import { useTodayKey } from '@/hooks/use-water';
import { runInBackground } from '@/services/error-reporting';
import { shareCard } from '@/services/share';
import { ACCENT } from '@/screens/home/summary';

import { Medal, ProgressLine } from './components/badge';
import { useAwardText, useAwards } from './data';

/**
 * One award, large: what earns it, where you stand, and a share button that
 * sends a picture of the medal, a line about it and the link to join.
 */

const styles = StyleSheet.create((theme) => ({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    content: {
        alignItems: 'center',
        gap: theme.space(3),
    },
    badge: {
        paddingVertical: theme.space(8),
    },
    name: {
        ...theme.fontSize['2xl'],
        fontWeight: theme.fontWeight.bold.fontWeight,
        textAlign: 'center',
        color: theme.colors.typography,
    },
    description: {
        ...theme.fontSize.default,
        textAlign: 'center',
        color: theme.colors.mutedTypography,
    },
    earned: {
        ...theme.fontSize.sm,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: ACCENT.distance,
    },
    progress: {
        width: 280,
        marginTop: theme.space(2),
    },
}));

const AwardScreen: FC = () => {
    const { t, i18n } = useTranslation(['screens']);
    const card = useRef<View>(null);
    const { awardId } = useLocalSearchParams<{ awardId: string }>();
    const today = useTodayKey();
    const { all } = useAwards(today);
    const text = useAwardText();
    const award = all.find((a) => a.id === awardId);

    if (!award) return null;

    const earned = award.earned || !!award.lastEarnedAt;
    const name = text.name(award);
    const earnedOn = dayjs(award.lastEarnedAt ?? undefined)
        .locale(i18n.language)
        .format('D MMM YYYY');

    const share = () =>
        runInBackground(
            () =>
                shareCard(
                    card,
                    t(earned ? 'share.award.earned' : 'share.award.progress', {
                        ns: 'screens',
                        name,
                        detail: text.detail(award),
                        url: JOIN_URL,
                    }),
                ),
            'Failed to share an award:',
        );

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={[modalStyles.content, styles.content]}
        >
            <ModalHeader
                title=""
                done={false}
                right={
                    <HeaderButton
                        icon="share"
                        onPress={share}
                        accessibilityLabel={t('awards.share', { ns: 'screens' })}
                    />
                }
            />
            <Box style={styles.badge}>
                <Medal {...award} earned={earned} size={240} />
            </Box>
            <Text style={styles.name} accessibilityRole="header">
                {text.name(award)}
            </Text>
            <Text style={styles.description}>{text.description(award)}</Text>
            {text.earned(award) ? <Text style={styles.earned}>{text.earned(award)}</Text> : null}
            <Box style={styles.progress}>
                <ProgressLine progress={award.progress} color={ACCENT.distance} />
            </Box>
            <ShareCard
                ref={card}
                accent={award.color}
                eyebrow={t(earned ? 'share.award.eyebrow' : 'share.award.eyebrowProgress', {
                    ns: 'screens',
                })}
                title={name}
                subtitle={earned ? earnedOn : text.detail(award)}
                art={<Medal {...award} earned={earned} size={210} />}
            />
        </ScrollView>
    );
};

export default AwardScreen;
