import { FC } from 'react';
import { router } from 'expo-router';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';

import { ScrollView } from '@/components/primitives/scrollview';
import { Box } from '@/components/primitives/box';
import { HStack } from '@/components/primitives/hstack';
import { VStack } from '@/components/primitives/vstack';
import { Text } from '@/components/primitives/text';
import { Icon } from '@/components/primitives/icon';
import { Pressable } from '@/components/primitives/pressable';
import { ModalHeader, modalStyles } from '@/components/layout/modal-header';
import { useTodayKey } from '@/hooks/use-water';
import { ACCENT } from '@/screens/home/summary';

import { Badge } from './components/badge';
import { AwardTile, openAward } from './components/tile';
import { AWARD_GROUPS, useAwardText, useAwards } from './data';

/**
 * Awards, after Apple Fitness's: Go For It (the award closest to earning,
 * with the next ones behind it), then every award by group.
 */

const styles = StyleSheet.create((theme) => ({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    card: {
        padding: theme.space(4),
        gap: theme.space(3),
        borderRadius: 22,
        borderCurve: 'continuous' as const,
        backgroundColor: theme.colors.elevated,
    },
    goRow: {
        alignItems: 'center',
        gap: theme.space(3),
    },
    goText: {
        flex: 1,
        gap: theme.space(0.5),
    },
    title: {
        fontSize: 20,
        lineHeight: 25,
        fontWeight: theme.fontWeight.bold.fontWeight,
        color: theme.colors.typography,
    },
    name: {
        ...theme.fontSize.default,
        color: theme.colors.typography,
    },
    muted: {
        ...theme.fontSize.sm,
        color: theme.colors.mutedTypography,
    },
    goSide: {
        alignItems: 'flex-end',
        alignSelf: 'stretch',
        justifyContent: 'space-between',
    },
    next: {
        marginLeft: -10,
    },
    link: {
        ...theme.fontSize.sm,
        color: ACCENT.distance,
    },
    groupHeader: {
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginHorizontal: -theme.space(1),
    },
}));

const AwardsScreen: FC = () => {
    const { t } = useTranslation(['screens']);
    const today = useTodayKey();
    const { all, goForIt } = useAwards(today);
    const text = useAwardText();
    const [top, ...next] = goForIt;

    return (
        <ScrollView style={styles.container} contentContainerStyle={modalStyles.content}>
            <ModalHeader title={t('awards.title', { ns: 'screens' })} done={false} />

            {top ? (
                <Pressable
                    style={[styles.card, styles.goRow, { flexDirection: 'row' }]}
                    onPress={() => openAward(top)}
                    accessibilityRole="button"
                >
                    <Badge {...top} size={72} />
                    <VStack style={styles.goText}>
                        <Text style={styles.title}>{t('awards.goForIt', { ns: 'screens' })}</Text>
                        <Text style={styles.name} numberOfLines={1}>
                            {text.name(top)}
                        </Text>
                        <Text style={styles.muted} numberOfLines={1}>
                            {text.detail(top)}
                        </Text>
                    </VStack>
                    <VStack style={styles.goSide}>
                        <HStack>
                            {next.slice(0, 2).map((award, i) => (
                                <Box key={award.id} style={i > 0 ? styles.next : undefined}>
                                    <Badge {...award} size={30} />
                                </Box>
                            ))}
                        </HStack>
                        <Pressable
                            onPress={() => router.navigate('/awards/go' as never)}
                            hitSlop={8}
                            accessibilityRole="button"
                        >
                            <Text style={styles.link}>
                                {t('awards.showAll', { ns: 'screens' })}
                            </Text>
                        </Pressable>
                    </VStack>
                </Pressable>
            ) : null}

            {AWARD_GROUPS.map((group) => (
                <VStack key={group} style={styles.card}>
                    <Pressable
                        onPress={() => router.navigate(`/awards/${group}` as never)}
                        accessibilityRole="button"
                    >
                        <HStack style={styles.groupHeader}>
                            <Text style={styles.title}>
                                {t(`awards.groups.${group}`, { ns: 'screens' })}
                            </Text>
                            <Icon name="chevron-right" size={16} color={ACCENT.distance} />
                        </HStack>
                    </Pressable>
                    <Box style={styles.grid}>
                        {all
                            .filter((award) => award.group === group)
                            .map((award) => (
                                <AwardTile key={award.id} award={award} size={84} />
                            ))}
                    </Box>
                </VStack>
            ))}
        </ScrollView>
    );
};

export default AwardsScreen;
