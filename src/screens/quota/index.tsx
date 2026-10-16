import { FC } from 'react';
import dayjs from 'dayjs';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';

import { ScrollView } from '@/components/primitives/scrollview';
import { HStack } from '@/components/primitives/hstack';
import { VStack } from '@/components/primitives/vstack';
import { Text } from '@/components/primitives/text';
import { Icon, type IconName } from '@/components/primitives/icon';
import { Card, CardTitle } from '@/components/layout/card';
import { ModalHeader, modalStyles } from '@/components/layout/modal-header';
import { ProgressBar } from '@/components/feedback/progress-bar';
import { useAiQuota } from '@/hooks/use-ai';

/**
 * D08: the month's AI plan builds, the one limited thing in the app.
 *
 * The number shown is the server's count (supabase/functions/syn-complete) once
 * it has answered a request this session, and this device's count until then.
 * The device-count and failed-attempt caveats show only while the number is the
 * device's, since the server's count is final and gives failed builds back.
 * There is no paid tier to sell: extra builds are said to be unavailable, not
 * faked.
 */

const FREE: { icon: IconName; key: string }[] = [
    { icon: 'home', key: 'today' },
    { icon: 'calendar', key: 'plan' },
    { icon: 'dumbbell', key: 'workouts' },
    { icon: 'droplet', key: 'water' },
    { icon: 'utensils', key: 'meals' },
    { icon: 'bar-chart', key: 'progress' },
    { icon: 'message', key: 'chat' },
];

const styles = StyleSheet.create((theme) => ({
    container: {
        flex: 1,
    },
    valueRow: {
        alignItems: 'baseline',
        gap: theme.space(1.5),
    },
    value: {
        fontSize: 56,
        lineHeight: 60,
        color: theme.colors.typography,
        ...theme.typography.metric,
    },
    unit: {
        ...theme.fontSize.default,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: theme.colors.mutedTypography,
    },
    body: {
        ...theme.fontSize.sm,
        color: theme.colors.mutedTypography,
    },
    list: {
        gap: theme.space(2.5),
    },
    item: {
        alignItems: 'center',
        gap: theme.space(3),
    },
    itemText: {
        ...theme.fontSize.default,
        flex: 1,
        color: theme.colors.typography,
    },
}));

const QuotaScreen: FC = () => {
    const { t } = useTranslation(['screens']);
    const { theme } = useUnistyles();
    const quota = useAiQuota();
    const summary = t('quota.left', { ns: 'screens', count: quota.remaining, limit: quota.limit });

    return (
        <ScrollView style={styles.container} contentContainerStyle={modalStyles.content}>
            <ModalHeader
                title={t('quota.title', { ns: 'screens' })}
                subtitle={t('quota.subtitle', { ns: 'screens', limit: quota.limit })}
            />

            <Card accessibilityLabel={summary}>
                <HStack style={styles.valueRow}>
                    <Text style={styles.value}>{quota.remaining}</Text>
                    <Text style={styles.unit}>
                        {t('quota.ofLimit', { ns: 'screens', limit: quota.limit })}
                    </Text>
                </HStack>
                <ProgressBar
                    value={quota.limit > 0 ? quota.remaining / quota.limit : 0}
                    segments={quota.limit}
                    accessibilityLabel={summary}
                />
                <Text style={styles.body}>
                    {t('quota.reset', {
                        ns: 'screens',
                        date: dayjs(quota.resetsOn).format('D MMMM'),
                    })}
                </Text>
                {quota.isServerCount ? null : (
                    <Text style={styles.body}>{t('quota.deviceCount', { ns: 'screens' })}</Text>
                )}
            </Card>

            <Card>
                <CardTitle icon="sparkles" title={t('quota.countsTitle', { ns: 'screens' })} />
                <Text style={styles.body}>{t('quota.counts', { ns: 'screens' })}</Text>
                <Text style={styles.body}>
                    {t(quota.isServerCount ? 'quota.refunded' : 'quota.failed', { ns: 'screens' })}
                </Text>
            </Card>

            <Card>
                <CardTitle
                    icon="check-circle"
                    color={theme.colors.success}
                    title={t('quota.freeTitle', { ns: 'screens' })}
                />
                <VStack style={styles.list}>
                    {FREE.map((entry) => (
                        <HStack key={entry.key} style={styles.item}>
                            <Icon
                                name={entry.icon}
                                size={18}
                                color={theme.colors.mutedTypography}
                            />
                            <Text style={styles.itemText}>
                                {t(`quota.free.${entry.key}`, { ns: 'screens' })}
                            </Text>
                        </HStack>
                    ))}
                </VStack>
            </Card>

            <Card>
                <CardTitle title={t('quota.moreTitle', { ns: 'screens' })} />
                <Text style={styles.body}>{t('quota.more', { ns: 'screens' })}</Text>
            </Card>
        </ScrollView>
    );
};

export default QuotaScreen;
