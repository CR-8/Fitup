import { FC } from 'react';
import { ScrollView } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';

import { Box } from '@/components/primitives/box';
import { HStack } from '@/components/primitives/hstack';
import { VStack } from '@/components/primitives/vstack';
import { Text } from '@/components/primitives/text';
import { Icon, type IconName } from '@/components/primitives/icon';
import { Pressable } from '@/components/primitives/pressable';
import { ModalHeader, modalStyles } from '@/components/layout/modal-header';
import { ACCENT } from '@/screens/home/summary';
import { SUMMARY_CARDS, useSummaryLayout, type SummaryCard } from '@/stores/summary-layout';

/**
 * Edit Summary, after Apple Fitness's "Add a Card to Your Summary": the cards on
 * Today in their order, each movable or removable, and the ones left to add,
 * each with what it shows.
 */

const ICONS: Record<SummaryCard, { icon: IconName; color: string }> = {
    workout: { icon: 'dumbbell', color: ACCENT.distance },
    water: { icon: 'droplet', color: ACCENT.water },
    distance: { icon: 'arrow-right', color: ACCENT.distance },
    sessions: { icon: 'calendar', color: ACCENT.sessions },
    progress: { icon: 'bar-chart', color: ACCENT.calories },
    calories: { icon: 'flame', color: ACCENT.calories },
    awards: { icon: 'trophy', color: ACCENT.sessions },
};

const styles = StyleSheet.create((theme) => ({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    section: {
        fontSize: 22,
        lineHeight: 28,
        fontWeight: theme.fontWeight.bold.fontWeight,
        color: theme.colors.typography,
        marginTop: theme.space(2),
    },
    group: {
        borderRadius: 22,
        borderCurve: 'continuous' as const,
        backgroundColor: theme.colors.foreground,
        overflow: 'hidden',
    },
    row: (first: boolean) => ({
        minHeight: 64,
        alignItems: 'center',
        gap: theme.space(3),
        paddingHorizontal: theme.space(4),
        paddingVertical: theme.space(2),
        borderTopWidth: first ? 0 : StyleSheet.hairlineWidth,
        borderTopColor: theme.colors.border,
    }),
    icon: (color: string) => ({
        height: 36,
        width: 36,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: `${color}26`,
    }),
    text: {
        flex: 1,
        gap: 2,
    },
    name: {
        ...theme.fontSize.default,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: theme.colors.typography,
    },
    detail: {
        ...theme.fontSize.sm,
        color: theme.colors.mutedTypography,
    },
    actions: {
        alignItems: 'center',
        gap: theme.space(2),
    },
    round: (color: string) => ({
        height: 30,
        width: 30,
        borderRadius: theme.radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: color,
    }),
    empty: {
        ...theme.fontSize.sm,
        color: theme.colors.mutedTypography,
        padding: theme.space(4),
    },
}));

const SummaryEditScreen: FC = () => {
    const { t } = useTranslation(['screens']);
    const { theme } = useUnistyles();
    const { cards, add, remove, move } = useSummaryLayout();
    const hidden = SUMMARY_CARDS.filter((card) => !cards.includes(card));

    const name = (card: SummaryCard) => t(`home.dash.cards.${card}.name`, { ns: 'screens' });

    const renderRow = (card: SummaryCard, index: number, shown: boolean) => (
        <HStack key={card} style={styles.row(index === 0)}>
            <Box style={styles.icon(ICONS[card].color)}>
                <Icon name={ICONS[card].icon} size={18} color={ICONS[card].color} />
            </Box>
            <VStack style={styles.text}>
                <Text style={styles.name}>{name(card)}</Text>
                <Text style={styles.detail} numberOfLines={2}>
                    {t(`home.dash.cards.${card}.detail`, { ns: 'screens' })}
                </Text>
            </VStack>
            {shown ? (
                <HStack style={styles.actions}>
                    <Pressable
                        disabled={index === 0}
                        onPress={() => move(card, -1)}
                        hitSlop={6}
                        accessibilityRole="button"
                        accessibilityLabel={t('home.dash.edit.up', {
                            ns: 'screens',
                            name: name(card),
                        })}
                    >
                        <Icon
                            name="chevron-up"
                            size={18}
                            color={
                                index === 0 ? theme.colors.neutral[600] : theme.colors.typography
                            }
                        />
                    </Pressable>
                    <Pressable
                        disabled={index === cards.length - 1}
                        onPress={() => move(card, 1)}
                        hitSlop={6}
                        accessibilityRole="button"
                        accessibilityLabel={t('home.dash.edit.down', {
                            ns: 'screens',
                            name: name(card),
                        })}
                    >
                        <Icon
                            name="chevron-down"
                            size={18}
                            color={
                                index === cards.length - 1
                                    ? theme.colors.neutral[600]
                                    : theme.colors.typography
                            }
                        />
                    </Pressable>
                    <Pressable
                        style={styles.round(theme.colors.destructive as string)}
                        onPress={() => remove(card)}
                        accessibilityRole="button"
                        accessibilityLabel={t('home.dash.edit.remove', {
                            ns: 'screens',
                            name: name(card),
                        })}
                    >
                        <Icon name="minus" size={14} color="#ffffff" />
                    </Pressable>
                </HStack>
            ) : (
                <Pressable
                    style={styles.round(ACCENT.distance)}
                    onPress={() => add(card)}
                    accessibilityRole="button"
                    accessibilityLabel={t('home.dash.edit.add', {
                        ns: 'screens',
                        name: name(card),
                    })}
                >
                    <Icon name="plus" size={14} color="#08090b" />
                </Pressable>
            )}
        </HStack>
    );

    return (
        <ScrollView style={styles.container} contentContainerStyle={modalStyles.content}>
            <ModalHeader
                title={t('home.dash.edit.title', { ns: 'screens' })}
                subtitle={t('home.dash.edit.subtitle', { ns: 'screens' })}
            />

            <Text style={styles.section}>{t('home.dash.edit.shown', { ns: 'screens' })}</Text>
            <VStack style={styles.group}>
                {cards.length ? (
                    cards.map((card, index) => renderRow(card, index, true))
                ) : (
                    <Text style={styles.empty}>{t('home.dash.edit.none', { ns: 'screens' })}</Text>
                )}
            </VStack>

            {hidden.length ? (
                <>
                    <Text style={styles.section}>
                        {t('home.dash.edit.addTitle', { ns: 'screens' })}
                    </Text>
                    <VStack style={styles.group}>
                        {hidden.map((card, index) => renderRow(card, index, false))}
                    </VStack>
                </>
            ) : null}
        </ScrollView>
    );
};

export default SummaryEditScreen;
