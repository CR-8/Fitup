import { FC } from 'react';
import { Share } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';

import { ScrollView } from '@/components/primitives/scrollview';
import { Box } from '@/components/primitives/box';
import { Text } from '@/components/primitives/text';
import { HeaderButton } from '@/components/buttons/header';
import { ModalHeader, modalStyles } from '@/components/layout/modal-header';
import { useTodayKey } from '@/hooks/use-water';
import { runInBackground } from '@/services/error-reporting';
import { ACCENT } from '@/screens/home/summary';

import { Badge, ProgressLine } from './components/badge';
import { useAwardText, useAwards } from './data';

/** One award, large: what earns it, where you stand, and a share button. */

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
    const { t } = useTranslation(['screens']);
    const { awardId } = useLocalSearchParams<{ awardId: string }>();
    const today = useTodayKey();
    const { all } = useAwards(today);
    const text = useAwardText();
    const award = all.find((a) => a.id === awardId);

    if (!award) return null;

    const share = () =>
        runInBackground(
            () =>
                Share.share({
                    message: t('awards.shareMessage', {
                        ns: 'screens',
                        name: text.name(award),
                        detail: text.detail(award),
                    }),
                }),
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
                <Badge {...award} size={240} />
            </Box>
            <Text style={styles.name} accessibilityRole="header">
                {text.name(award)}
            </Text>
            <Text style={styles.description}>{text.description(award)}</Text>
            {text.earned(award) ? <Text style={styles.earned}>{text.earned(award)}</Text> : null}
            <Box style={styles.progress}>
                <ProgressLine progress={award.progress} color={ACCENT.distance} />
            </Box>
        </ScrollView>
    );
};

export default AwardScreen;
