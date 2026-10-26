import { FC } from 'react';
import { router } from 'expo-router';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';

import { ScrollView } from '@/components/primitives/scrollview';
import { HStack } from '@/components/primitives/hstack';
import { VStack } from '@/components/primitives/vstack';
import { Text } from '@/components/primitives/text';
import { Icon, type IconName } from '@/components/primitives/icon';
import { Card } from '@/components/layout/card';
import { SkeletonList } from '@/components/feedback/skeleton';
import { ModalHeader, modalStyles } from '@/components/layout/modal-header';
import type { AiPlanSelect } from '@/db/schema';
import { usePlans } from '@/hooks/use-ai';
import { planRange, planStatus, type PlanStatus } from '@/helpers/ai-plan';

/**
 * D07 Saved plans: what Syn has built, split by where each plan stands. A
 * draft has changed nothing; an active plan is on the schedule and inside its
 * dates; an ended one ran its course; an archived one was undone or replaced.
 */

const KIND_ICON: Record<AiPlanSelect['kind'], IconName> = {
    workout: 'dumbbell',
    nutrition: 'utensils',
    combined: 'sparkles',
};

const SECTIONS: PlanStatus[] = ['active', 'draft', 'ended', 'archived'];

const styles = StyleSheet.create((theme) => ({
    container: {
        flex: 1,
    },
    section: {
        gap: theme.space(2),
    },
    sectionTitle: {
        ...theme.typography.eyebrow,
        textTransform: 'uppercase',
        color: theme.colors.mutedTypography,
        paddingHorizontal: theme.space(1),
    },
    row: {
        alignItems: 'center',
        gap: theme.space(3),
    },
    text: {
        flex: 1,
        gap: theme.space(0.5),
    },
    title: {
        ...theme.fontSize.default,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: theme.colors.typography,
    },
    meta: {
        ...theme.fontSize.sm,
        color: theme.colors.mutedTypography,
    },
    status: {
        ...theme.typography.eyebrow,
        textTransform: 'uppercase',
    },
    empty: {
        ...theme.fontSize.sm,
        color: theme.colors.mutedTypography,
    },
}));

const PlanRow: FC<{ plan: AiPlanSelect }> = ({ plan }) => {
    const { t, i18n } = useTranslation(['screens']);
    const { theme } = useUnistyles();
    const status = planStatus(plan);
    const meta = [
        t(`coach.plans.kind.${plan.kind}`, { ns: 'screens' }),
        plan.status === 'applied'
            ? planRange(plan, i18n.language)
            : dayjs(plan.createdAt).locale(i18n.language).format('D MMM'),
    ].join(' · ');

    return (
        <Card
            onPress={() => router.navigate(`/coach/plan/${plan.id}` as never)}
            accessibilityLabel={`${plan.payload.title}, ${t(`coach.plans.status.${status}`, {
                ns: 'screens',
            })}, ${meta}`}
        >
            <HStack style={styles.row}>
                <Icon name={KIND_ICON[plan.kind]} size={20} color={theme.colors.primary} />
                <VStack style={styles.text}>
                    <Text
                        style={[
                            styles.status,
                            {
                                color:
                                    status === 'active'
                                        ? theme.colors.success
                                        : theme.colors.mutedTypography,
                            },
                        ]}
                    >
                        {t(`coach.plans.status.${status}`, { ns: 'screens' })}
                    </Text>
                    <Text style={styles.title} numberOfLines={2}>
                        {plan.payload.title}
                    </Text>
                    <Text style={styles.meta}>{meta}</Text>
                </VStack>
                <Icon name="chevron-right" size={16} color={theme.colors.mutedTypography} />
            </HStack>
        </Card>
    );
};

const PlansScreen: FC = () => {
    const { t } = useTranslation(['screens']);
    const { plans, isLoading } = usePlans();

    return (
        <ScrollView style={styles.container} contentContainerStyle={modalStyles.content}>
            <ModalHeader
                title={t('coach.plans.title', { ns: 'screens' })}
                subtitle={t('coach.plans.subtitle', { ns: 'screens' })}
                done={false}
            />

            {isLoading ? <SkeletonList count={3} /> : null}

            {!isLoading && plans.length === 0 ? (
                <Text style={styles.empty}>{t('coach.plans.empty', { ns: 'screens' })}</Text>
            ) : null}

            {SECTIONS.map((key) => {
                const rows = plans.filter((plan) => planStatus(plan) === key);
                if (rows.length === 0) return null;

                return (
                    <VStack key={key} style={styles.section}>
                        <Text style={styles.sectionTitle} accessibilityRole="header">
                            {t(`coach.plans.sections.${key}`, { ns: 'screens' })}
                        </Text>
                        {rows.map((plan) => (
                            <PlanRow key={plan.id} plan={plan} />
                        ))}
                    </VStack>
                );
            })}
        </ScrollView>
    );
};

export default PlansScreen;
