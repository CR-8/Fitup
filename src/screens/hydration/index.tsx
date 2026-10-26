import { FC, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';

import { ScrollView } from '@/components/primitives/scrollview';
import { HStack } from '@/components/primitives/hstack';
import { VStack } from '@/components/primitives/vstack';
import { Text } from '@/components/primitives/text';
import { Pressable } from '@/components/primitives/pressable';
import { Icon } from '@/components/primitives/icon';
import { Card, CardTitle } from '@/components/layout/card';
import { ModalHeader, modalStyles } from '@/components/layout/modal-header';
import { ProgressBar } from '@/components/feedback/progress-bar';
import { Separator } from '@/components/layout/separator';
import { ChoiceChips } from '@/components/forms/choice-chips';
import {
    WATER_GLASS_SIZES_ML,
    WATER_QUICK_ADD_ML,
    WATER_TARGET_MAX_ML,
    WATER_TARGET_MIN_ML,
    WATER_TARGET_STEP_ML,
} from '@/constants/water';
import { formatTime } from '@/helpers/times';
import { Skeleton } from '@/components/feedback/skeleton';
import { AxisBars, Metric, PeriodPicker } from '@/screens/home/components/charts';
import { ACCENT, PERIODS, axisFor, useWaterSummary, type Period } from '@/screens/home/summary';
import { useUser } from '@/hooks/use-user';
import {
    formatGlasses,
    formatWater,
    useTodayKey,
    useWaterDay,
    useWaterLogging,
    useWaterSettings,
} from '@/hooks/use-water';

/**
 * B03 Hydration, the one water screen: today's total against the goal, one-tap
 * sizes, the history by day, week, month or year, the day's entries (each
 * removable, the last one undoable), and the goal itself. Today's dial and its
 * Water card both open it, the card on its own period.
 */

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
        color: theme.colors.hydration,
        ...theme.typography.metric,
    },
    unit: {
        ...theme.fontSize.default,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: theme.colors.mutedTypography,
    },
    caption: {
        ...theme.fontSize.sm,
        color: theme.colors.mutedTypography,
    },
    reached: {
        ...theme.fontSize.sm,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: theme.colors.success,
    },
    sizes: {
        gap: theme.space(2),
    },
    size: {
        flex: 1,
        minHeight: 52,
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.space(0.5),
        borderRadius: theme.radius['2xl'],
        borderCurve: 'continuous',
        backgroundColor: theme.colors.hydrationSoft,
    },
    sizeLabel: {
        ...theme.fontSize.sm,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: theme.colors.hydration,
    },
    sizeAmount: {
        ...theme.fontSize.xs,
        color: theme.colors.hydration,
    },
    link: {
        ...theme.fontSize.sm,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: theme.colors.primary,
    },
    entry: {
        alignItems: 'center',
        justifyContent: 'space-between',
        minHeight: 44,
        gap: theme.space(3),
    },
    entryTime: {
        ...theme.fontSize.default,
        color: theme.colors.typography,
        ...theme.typography.metric,
    },
    entryAmount: {
        ...theme.fontSize.default,
        flex: 1,
        color: theme.colors.typography,
    },
    iconButton: {
        height: 44,
        width: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    stepper: {
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    stepButton: {
        height: 44,
        width: 44,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: theme.radius.full,
        backgroundColor: theme.colors.elevated,
    },
    stepValue: {
        fontSize: 34,
        lineHeight: 38,
        color: theme.colors.typography,
        ...theme.typography.metric,
    },
    disabled: {
        opacity: 0.4,
    },
    note: {
        ...theme.fontSize.xs,
        color: theme.colors.mutedTypography,
    },
}));

const HydrationScreen: FC = () => {
    const { t, i18n } = useTranslation(['screens']);
    const { theme } = useUnistyles();
    const { user } = useUser();
    const today = useTodayKey();
    const water = useWaterDay(today);
    const params = useLocalSearchParams<{ period?: string }>();
    const [period, setPeriod] = useState<Period>(
        PERIODS.find((p) => p === params.period) ?? 'week',
    );
    const history = useWaterSummary(period, today);
    const { x, ticks } = axisFor(period, history.buckets, i18n.language);
    const settings = useWaterSettings();
    const { addWater, removeWater } = useWaterLogging();

    const lastLog = water.logs[water.logs.length - 1];
    const summary = t('hydration.glassesOf', {
        ns: 'screens',
        glasses: formatGlasses(water.glasses),
        target: water.targetGlasses,
    });

    const setTarget = (next: number) =>
        settings.save({
            waterTargetMl: Math.min(WATER_TARGET_MAX_ML, Math.max(WATER_TARGET_MIN_ML, next)),
        });

    const sizes = [
        { key: 'glass', ml: water.glassMl, label: t('hydration.oneGlass', { ns: 'screens' }) },
        ...WATER_QUICK_ADD_ML.filter((ml) => ml !== water.glassMl).map((ml) => ({
            key: String(ml),
            ml,
            label: formatWater(ml),
        })),
    ];

    return (
        <ScrollView style={styles.container} contentContainerStyle={modalStyles.content}>
            <ModalHeader
                title={t('hydration.title', { ns: 'screens' })}
                subtitle={t('hydration.subtitle', { ns: 'screens' })}
            />

            <Card accessibilityLabel={summary}>
                <HStack style={styles.valueRow}>
                    {water.isLoading ? (
                        <Skeleton width={72} height={56} />
                    ) : (
                        <Text style={styles.value}>{formatGlasses(water.glasses)}</Text>
                    )}
                    <Text style={styles.unit}>
                        {t('hydration.ofGlasses', { ns: 'screens', count: water.targetGlasses })}
                    </Text>
                </HStack>
                <Text style={styles.caption}>
                    {t('hydration.mlOf', {
                        ns: 'screens',
                        total: formatWater(water.totalMl),
                        target: formatWater(water.targetMl),
                    })}
                </Text>
                <ProgressBar
                    value={water.progress}
                    segments={water.targetGlasses}
                    color={theme.colors.hydration}
                    height={10}
                    accessibilityLabel={summary}
                />
                {water.progress >= 1 ? (
                    <Text style={styles.reached}>{t('hydration.reached', { ns: 'screens' })}</Text>
                ) : null}
            </Card>

            <HStack style={styles.sizes}>
                {sizes.map((size) => (
                    <Pressable
                        key={size.key}
                        style={styles.size}
                        onPress={() => addWater(today, size.ml)}
                        accessibilityRole="button"
                        accessibilityLabel={t('hydration.addAmountLabel', {
                            ns: 'screens',
                            amount: formatWater(size.ml),
                        })}
                    >
                        <Text style={styles.sizeLabel}>+ {size.label}</Text>
                        {size.key === 'glass' ? (
                            <Text style={styles.sizeAmount}>{formatWater(size.ml)}</Text>
                        ) : null}
                    </Pressable>
                ))}
            </HStack>

            <Card>
                <CardTitle title={t('hydration.history', { ns: 'screens' })} />
                <PeriodPicker
                    labels={PERIODS.map((p) => t(`metric.short.${p}`, { ns: 'screens' }))}
                    index={PERIODS.indexOf(period)}
                    onChange={(index) => setPeriod(PERIODS[index])}
                />
                <Text style={styles.caption}>{t(`metric.this.${period}`, { ns: 'screens' })}</Text>
                <Metric
                    value={history.water.litres.toFixed(1)}
                    unit="L"
                    color={ACCENT.water}
                    size={30}
                />
                <AxisBars
                    data={history.water.series.map((ml) => ml / 1000)}
                    x={x}
                    ticks={ticks}
                    color={ACCENT.water}
                />
            </Card>

            <Card>
                <CardTitle
                    title={t('hydration.today', { ns: 'screens' })}
                    trailing={
                        lastLog ? (
                            <Pressable
                                onPress={() => removeWater(today, lastLog.id)}
                                accessibilityRole="button"
                                accessibilityLabel={t('hydration.undoLastLabel', {
                                    ns: 'screens',
                                    amount: formatWater(lastLog.amountMl),
                                })}
                                hitSlop={8}
                            >
                                <Text style={styles.link}>
                                    {t('hydration.undoLast', { ns: 'screens' })}
                                </Text>
                            </Pressable>
                        ) : undefined
                    }
                />

                {water.isError ? (
                    <HStack style={styles.entry}>
                        <Text style={styles.caption}>
                            {t('hydration.errors.load', { ns: 'screens' })}
                        </Text>
                        <Pressable onPress={() => water.refetch()} accessibilityRole="button">
                            <Text style={styles.link}>
                                {t('hydration.retry', { ns: 'screens' })}
                            </Text>
                        </Pressable>
                    </HStack>
                ) : water.logs.length === 0 ? (
                    <Text style={styles.caption}>{t('hydration.empty', { ns: 'screens' })}</Text>
                ) : (
                    <VStack>
                        {[...water.logs].reverse().map((log, index) => {
                            const time = formatTime(log.createdAt, user?.timeFormat ?? '24h');

                            return (
                                <VStack key={log.id}>
                                    {index > 0 ? <Separator /> : null}
                                    <HStack style={styles.entry}>
                                        <Text style={styles.entryTime}>{time}</Text>
                                        <Text style={styles.entryAmount}>
                                            {formatWater(log.amountMl)}
                                        </Text>
                                        <Pressable
                                            style={styles.iconButton}
                                            onPress={() => removeWater(today, log.id)}
                                            accessibilityRole="button"
                                            accessibilityLabel={t('hydration.removeLabel', {
                                                ns: 'screens',
                                                amount: formatWater(log.amountMl),
                                                time,
                                            })}
                                        >
                                            <Icon
                                                name="trash"
                                                size={18}
                                                color={theme.colors.mutedTypography}
                                            />
                                        </Pressable>
                                    </HStack>
                                </VStack>
                            );
                        })}
                    </VStack>
                )}
            </Card>

            <Card>
                <CardTitle title={t('hydration.goal', { ns: 'screens' })} />
                <HStack style={styles.stepper}>
                    <Pressable
                        style={[
                            styles.stepButton,
                            settings.targetMl <= WATER_TARGET_MIN_ML && styles.disabled,
                        ]}
                        onPress={() => setTarget(settings.targetMl - WATER_TARGET_STEP_ML)}
                        disabled={settings.targetMl <= WATER_TARGET_MIN_ML}
                        accessibilityRole="button"
                        accessibilityLabel={t('hydration.decreaseGoal', { ns: 'screens' })}
                    >
                        <Icon name="minus" size={20} color={theme.colors.typography} />
                    </Pressable>
                    <Text
                        style={styles.stepValue}
                        accessibilityLabel={t('hydration.goalLabel', {
                            ns: 'screens',
                            amount: formatWater(settings.targetMl),
                        })}
                    >
                        {formatWater(settings.targetMl)}
                    </Text>
                    <Pressable
                        style={[
                            styles.stepButton,
                            settings.targetMl >= WATER_TARGET_MAX_ML && styles.disabled,
                        ]}
                        onPress={() => setTarget(settings.targetMl + WATER_TARGET_STEP_ML)}
                        disabled={settings.targetMl >= WATER_TARGET_MAX_ML}
                        accessibilityRole="button"
                        accessibilityLabel={t('hydration.increaseGoal', { ns: 'screens' })}
                    >
                        <Icon name="plus" size={20} color={theme.colors.typography} />
                    </Pressable>
                </HStack>
                {settings.isDefaultTarget ? (
                    <Text style={styles.caption}>
                        {t('hydration.defaultGoal', { ns: 'screens' })}
                    </Text>
                ) : null}

                <Separator />

                <Text style={styles.caption}>{t('hydration.glassSize', { ns: 'screens' })}</Text>
                <ChoiceChips
                    options={WATER_GLASS_SIZES_ML.map((ml) => ({
                        value: ml,
                        label: formatWater(ml),
                    }))}
                    selected={[settings.glassMl]}
                    onToggle={(ml) => settings.save({ waterGlassMl: ml })}
                    color={theme.colors.hydration}
                    softColor={theme.colors.hydrationSoft}
                />
            </Card>

            <Text style={styles.note}>{t('hydration.source', { ns: 'screens' })}</Text>
        </ScrollView>
    );
};

export default HydrationScreen;
