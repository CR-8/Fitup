import { FC, useEffect, useMemo, useState } from 'react';
import { Platform, ScrollView, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';

import { Box } from '@/components/primitives/box';
import { HStack } from '@/components/primitives/hstack';
import { VStack } from '@/components/primitives/vstack';
import { Text } from '@/components/primitives/text';
import { Input } from '@/components/primitives/input';
import { Icon } from '@/components/primitives/icon';
import { Pressable } from '@/components/primitives/pressable';
import { Button } from '@/components/buttons/base';
import { HeaderTextButton } from '@/components/buttons/header';
import { Stack } from '@/navigators/stack';
import { AI_CONFIG } from '@/constants/ai';
import { useAccount } from '@/hooks/use-account';
import { useAiAvailable, useAiProfile, useSynActions } from '@/hooks/use-ai';
import { ACCENT } from '@/screens/home/summary';
import { hasSeenSynWelcome } from '@/screens/syn-welcome';

import { ActivityIcon } from './components/activity-icon';
import { HeaderArt } from './components/header-art';
import { MenuPicker } from '@/components/forms/menu-picker';
import { SessionSheet } from './components/session-sheet';
import {
    ACTIVITIES,
    GOALS,
    MINUTE_OPTIONS,
    PLACES,
    WEEKDAYS,
    WEEK_OPTIONS,
    buildBrief,
    nextOn,
    splitWeek,
    useBuildPlanStore,
    type Goal,
    type Place,
    type Session,
    type Weekday,
} from './plan';

/**
 * Build Your Plan, after Apple Fitness: pick the days, the time each day, the
 * plan's length and the kinds of training; Review lays them out as sessions
 * per day to change, sets the start and the few things Syn would otherwise
 * ask (goal, where, injuries); Create Plan sends it all to Syn at once.
 */

const LIME = ACCENT.distance;

const styles = StyleSheet.create((theme, rt) => ({
    container: {
        flex: 1,
        backgroundColor: '#1c1e22',
    },
    content: {
        paddingHorizontal: theme.space(4),
        paddingTop: Platform.OS === 'android' ? rt.insets.top : 0,
        paddingBottom: theme.space(32),
        gap: theme.space(3),
    },
    navRow: {
        height: 44,
        alignItems: 'center',
    },
    title: {
        fontSize: 30,
        lineHeight: 36,
        fontWeight: theme.fontWeight.bold.fontWeight,
        textAlign: 'center',
        color: theme.colors.typography,
        marginBottom: theme.space(2),
    },
    subtitle: {
        ...theme.fontSize.default,
        textAlign: 'center',
        color: theme.colors.mutedTypography,
    },
    section: {
        fontSize: 22,
        lineHeight: 28,
        fontWeight: theme.fontWeight.bold.fontWeight,
        color: theme.colors.typography,
        marginTop: theme.space(4),
    },
    hint: {
        ...theme.fontSize.sm,
        color: theme.colors.mutedTypography,
        marginTop: -theme.space(2),
    },
    group: {
        borderRadius: theme.radius.xl,
        backgroundColor: theme.colors.elevated,
        overflow: 'hidden',
    },
    row: {
        minHeight: 52,
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.space(3),
        paddingHorizontal: theme.space(4),
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: theme.colors.border,
    },
    rowLabel: {
        ...theme.fontSize.default,
        flexShrink: 1,
        color: theme.colors.typography,
    },
    days: {
        justifyContent: 'space-between',
        padding: theme.space(3),
    },
    day: (selected: boolean) => ({
        height: 40,
        width: 40,
        borderRadius: theme.radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: selected ? LIME : 'transparent',
        backgroundColor: selected ? `${LIME}1f` : 'transparent',
    }),
    dayText: (selected: boolean) => ({
        ...theme.fontSize.default,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: selected ? LIME : theme.colors.typography,
    }),
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: theme.space(2),
    },
    tile: (selected: boolean) => ({
        width: '31.8%',
        height: 96,
        justifyContent: 'space-between',
        padding: theme.space(3),
        borderRadius: theme.radius.xl,
        borderWidth: 1.5,
        borderColor: selected ? LIME : 'transparent',
        backgroundColor: theme.colors.elevated,
    }),
    tileText: (selected: boolean) => ({
        ...theme.fontSize.default,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: selected ? LIME : theme.colors.typography,
    }),
    startRow: {
        alignSelf: 'center',
        alignItems: 'center',
        gap: theme.space(1),
    },
    cards: {
        gap: theme.space(3),
        paddingRight: theme.space(4),
    },
    card: (width: number) => ({
        width,
        borderRadius: theme.radius.xl,
        backgroundColor: theme.colors.elevated,
        overflow: 'hidden',
    }),
    cardHeader: {
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: theme.space(4),
        paddingVertical: theme.space(3),
    },
    cardDay: {
        ...theme.fontSize.default,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: theme.colors.typography,
    },
    muted: {
        ...theme.fontSize.default,
        color: theme.colors.mutedTypography,
    },
    session: {
        alignItems: 'center',
        gap: theme.space(3),
        paddingHorizontal: theme.space(4),
        paddingVertical: theme.space(2),
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: theme.colors.border,
    },
    sessionIcon: {
        height: 44,
        width: 44,
        borderRadius: theme.radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.neutral[700],
    },
    sessionText: {
        flex: 1,
    },
    sessionName: {
        ...theme.fontSize.default,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: theme.colors.typography,
    },
    addRow: {
        alignItems: 'center',
        gap: theme.space(3),
        paddingHorizontal: theme.space(4),
        paddingVertical: theme.space(3),
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: theme.colors.border,
    },
    input: {
        ...theme.fontSize.default,
        minHeight: 48,
        marginHorizontal: theme.space(4),
        marginBottom: theme.space(3),
        paddingHorizontal: theme.space(3),
        borderRadius: theme.radius.lg,
        backgroundColor: theme.colors.input,
        color: theme.colors.typography,
    },
    footer: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        gap: theme.space(2),
        paddingHorizontal: theme.space(4),
        paddingTop: theme.space(3),
        paddingBottom: rt.insets.bottom + theme.space(3),
        backgroundColor: 'rgba(28, 30, 34, 0.94)',
    },
    footerText: {
        ...theme.fontSize.sm,
        textAlign: 'center',
        color: theme.colors.mutedTypography,
    },
}));

const BuildPlanScreen: FC = () => {
    const { t, i18n } = useTranslation(['screens', 'common']);
    const { width } = useWindowDimensions();
    const [step, setStep] = useState<'build' | 'review'>('build');
    const [sheet, setSheet] = useState<{ day: Weekday; index: number | null } | null>(null);
    const plan = useBuildPlanStore();

    const available = useAiAvailable();
    const { isSignedIn } = useAccount();
    const { profile, save } = useAiProfile();
    const { generate, quota, exhausted, isBusy, conversation } = useSynActions();

    // Prefilled from the profile, and saved back to it on Create Plan.
    const [goalDraft, setGoal] = useState<Goal | null>(null);
    const [placeDraft, setPlace] = useState<Place | null>(null);
    const [conditionsDraft, setConditions] = useState<string | null>(null);
    const [injured, setInjured] = useState<boolean | null>(null);
    const goal = goalDraft ?? profile?.goal ?? 'maintain';
    const place = placeDraft ?? profile?.trainingEnvironment ?? 'gym';
    const conditionsText = conditionsDraft ?? (profile?.conditions ?? []).join(', ');
    const hasInjuries = injured ?? conditionsText.trim().length > 0;

    const locale = (date: dayjs.Dayjs) => date.locale(i18n.language);
    const today = dayjs().startOf('day');

    // A new visit starts from a clean form; Syn's AI caution comes first, once.
    useEffect(() => {
        if (!hasSeenSynWelcome()) router.navigate('/syn-welcome' as never);
        return () => plan.reset();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const starts = useMemo(() => {
        const dates = [today, ...plan.days.map((day) => nextOn(day, today.add(1, 'day')))];
        const unique = [...new Map(dates.map((d) => [d.valueOf(), d])).values()];
        return unique.sort((a, b) => a.diff(b)).slice(0, 4);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [plan.days]);
    const start = plan.start ? dayjs(plan.start) : today;
    const dateLabel = (date: dayjs.Dayjs) =>
        date.isSame(today, 'day')
            ? t('coach.build.today', { ns: 'screens', date: locale(date).format('MMMM D') })
            : locale(date).format('dddd, MMMM D');

    const signInNeeded = AI_CONFIG.transport === 'proxy' && !isSignedIn;
    const canReview = plan.days.length > 0 && plan.activities.length > 0;
    const canCreate =
        available &&
        !!conversation &&
        !signInNeeded &&
        !exhausted &&
        !isBusy &&
        Object.keys(plan.schedule).length > 0;

    const toggleDay = (day: Weekday) =>
        plan.set({
            days: plan.days.includes(day)
                ? plan.days.filter((d) => d !== day)
                : [...plan.days, day].sort(),
        });

    const toggleActivity = (activity: (typeof ACTIVITIES)[number]) =>
        plan.set({
            activities: plan.activities.includes(activity)
                ? plan.activities.filter((a) => a !== activity)
                : [...plan.activities, activity],
        });

    const openReview = () => {
        plan.set({ schedule: splitWeek(plan.days, plan.minutes, plan.activities), start: null });
        setStep('review');
    };

    const create = async () => {
        if (!canCreate) return;
        const conditions = hasInjuries
            ? conditionsText
                  .split(',')
                  .map((c) => c.trim())
                  .filter(Boolean)
            : [];

        try {
            await save({
                goal,
                trainingEnvironment: place,
                sessionsPerWeek: plan.days.length,
                sessionMinutes: plan.minutes,
                conditions,
            });
        } catch {
            // The brief carries every answer anyway.
        }

        const { intent, horizonDays } = buildBrief({
            start,
            weeks: plan.weeks,
            schedule: plan.schedule,
            goal,
            place,
            conditions,
        });

        if (
            generate('workout', intent, horizonDays, {
                repeatWeeks: plan.weeks,
                ready: true,
                autoApply: true,
            })
        ) {
            router.back();
        }
    };

    const updateDay = (day: Weekday, update: (sessions: Session[]) => Session[]) => {
        const next = update([...(plan.schedule[day] ?? [])]);
        const schedule = { ...plan.schedule };
        if (next.length) schedule[day] = next;
        else delete schedule[day];
        plan.set({ schedule });
    };

    const navButton = (
        <HeaderTextButton
            title={t(step === 'build' ? 'cancel' : 'coach.build.back', {
                ns: step === 'build' ? 'common' : 'screens',
            })}
            onPress={() => (step === 'build' ? router.back() : setStep('build'))}
        />
    );

    const weekdayName = (day: Weekday) => locale(dayjs().day((day + 1) % 7)).format('dddd');
    const cardWidth = width * 0.78;

    return (
        <Box style={styles.container}>
            {Platform.OS === 'ios' ? (
                <Stack.Screen options={{ title: '', headerLeft: () => navButton }} />
            ) : null}

            <ScrollView
                contentContainerStyle={styles.content}
                contentInsetAdjustmentBehavior="automatic"
            >
                {Platform.OS === 'android' ? (
                    <HStack style={styles.navRow}>{navButton}</HStack>
                ) : null}

                {step === 'build' ? (
                    <>
                        <HeaderArt />
                        <Text style={styles.title} accessibilityRole="header">
                            {t('coach.build.title', { ns: 'screens' })}
                        </Text>

                        <Text style={styles.section}>
                            {t('coach.build.schedule', { ns: 'screens' })}
                        </Text>
                        <VStack style={styles.group}>
                            <HStack style={styles.days}>
                                {WEEKDAYS.map((day) => {
                                    const selected = plan.days.includes(day);
                                    return (
                                        <Pressable
                                            key={day}
                                            style={styles.day(selected)}
                                            onPress={() => toggleDay(day)}
                                            accessibilityRole="checkbox"
                                            accessibilityState={{ checked: selected }}
                                            accessibilityLabel={weekdayName(day)}
                                        >
                                            <Text style={styles.dayText(selected)}>
                                                {weekdayName(day).charAt(0)}
                                            </Text>
                                        </Pressable>
                                    );
                                })}
                            </HStack>
                            <HStack style={styles.row}>
                                <Text style={styles.rowLabel}>
                                    {t('coach.build.timePerDay', { ns: 'screens' })}
                                </Text>
                                <MenuPicker
                                    value={plan.minutes}
                                    options={MINUTE_OPTIONS.map((value) => ({
                                        value,
                                        label: t('coach.build.minutesValue', {
                                            ns: 'screens',
                                            count: value,
                                        }),
                                    }))}
                                    onChange={(minutes) => plan.set({ minutes })}
                                    accessibilityLabel={t('coach.build.timePerDay', {
                                        ns: 'screens',
                                    })}
                                />
                            </HStack>
                            <HStack style={styles.row}>
                                <Text style={styles.rowLabel}>
                                    {t('coach.build.length', { ns: 'screens' })}
                                </Text>
                                <MenuPicker
                                    value={plan.weeks}
                                    options={WEEK_OPTIONS.map((value) => ({
                                        value,
                                        label: t('coach.build.weeksValue', {
                                            ns: 'screens',
                                            count: value,
                                        }),
                                    }))}
                                    onChange={(weeks) => plan.set({ weeks })}
                                    accessibilityLabel={t('coach.build.length', { ns: 'screens' })}
                                />
                            </HStack>
                        </VStack>

                        <Text style={styles.section}>
                            {t('coach.build.activities', { ns: 'screens' })}
                        </Text>
                        <Text style={styles.hint}>
                            {t('coach.build.activitiesHint', { ns: 'screens' })}
                        </Text>
                        <Box style={styles.grid}>
                            {ACTIVITIES.map((activity) => {
                                const selected = plan.activities.includes(activity);
                                return (
                                    <Pressable
                                        key={activity}
                                        style={styles.tile(selected)}
                                        onPress={() => toggleActivity(activity)}
                                        accessibilityRole="checkbox"
                                        accessibilityState={{ checked: selected }}
                                    >
                                        <ActivityIcon
                                            activity={activity}
                                            size={22}
                                            color={selected ? LIME : '#9a9fa8'}
                                        />
                                        <Text style={styles.tileText(selected)} numberOfLines={1}>
                                            {t(`coach.build.types.${activity}`, { ns: 'screens' })}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </Box>
                    </>
                ) : (
                    <>
                        <Text style={styles.title} accessibilityRole="header">
                            {t('coach.build.reviewTitle', { ns: 'screens' })}
                        </Text>
                        <HStack style={styles.startRow}>
                            <Text style={styles.muted}>
                                {t('coach.build.starts', { ns: 'screens' })}
                            </Text>
                            <MenuPicker
                                value={start.valueOf()}
                                options={starts.map((date) => ({
                                    value: date.valueOf(),
                                    label: dateLabel(date),
                                }))}
                                onChange={(value) =>
                                    plan.set({ start: dayjs(value).toISOString() })
                                }
                                accessibilityLabel={t('coach.build.starts', { ns: 'screens' })}
                                color={LIME}
                            />
                        </HStack>

                        <Text style={styles.section}>
                            {t('coach.build.schedule', { ns: 'screens' })}
                        </Text>
                        <Text style={styles.hint}>
                            {t('coach.build.scheduleHint', { ns: 'screens' })}
                        </Text>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            snapToInterval={cardWidth + 12}
                            decelerationRate="fast"
                            contentContainerStyle={styles.cards}
                        >
                            {plan.days.map((day) => {
                                const sessions = plan.schedule[day] ?? [];
                                const total = sessions.reduce((sum, s) => sum + s.minutes, 0);
                                return (
                                    <VStack key={day} style={styles.card(cardWidth)}>
                                        <HStack style={styles.cardHeader}>
                                            <Text style={styles.cardDay}>{weekdayName(day)}</Text>
                                            <Text style={styles.muted}>
                                                {total
                                                    ? t('coach.build.minutesValue', {
                                                          ns: 'screens',
                                                          count: total,
                                                      })
                                                    : t('coach.build.rest', { ns: 'screens' })}
                                            </Text>
                                        </HStack>
                                        {sessions.map((session, index) => (
                                            <Pressable
                                                key={index}
                                                onPress={() => setSheet({ day, index })}
                                                accessibilityRole="button"
                                            >
                                                <HStack style={styles.session}>
                                                    <Box style={styles.sessionIcon}>
                                                        <ActivityIcon
                                                            activity={session.activity}
                                                            size={22}
                                                            color={LIME}
                                                        />
                                                    </Box>
                                                    <VStack style={styles.sessionText}>
                                                        <Text
                                                            style={styles.sessionName}
                                                            numberOfLines={1}
                                                        >
                                                            {t(
                                                                `coach.build.types.${session.activity}`,
                                                                { ns: 'screens' },
                                                            )}
                                                        </Text>
                                                        <Text style={styles.muted}>
                                                            {t('coach.build.minutesValue', {
                                                                ns: 'screens',
                                                                count: session.minutes,
                                                            })}
                                                        </Text>
                                                    </VStack>
                                                    <Icon
                                                        name="chevron-right"
                                                        size={14}
                                                        color="#9a9fa8"
                                                    />
                                                </HStack>
                                            </Pressable>
                                        ))}
                                        <Pressable
                                            onPress={() => setSheet({ day, index: null })}
                                            accessibilityRole="button"
                                        >
                                            <HStack style={styles.addRow}>
                                                <Icon name="plus" size={16} color="#9a9fa8" />
                                                <Text style={styles.muted}>
                                                    {t('coach.build.add', { ns: 'screens' })}
                                                </Text>
                                            </HStack>
                                        </Pressable>
                                    </VStack>
                                );
                            })}
                        </ScrollView>

                        <Text style={styles.section}>
                            {t('coach.build.preferences', { ns: 'screens' })}
                        </Text>
                        <VStack style={styles.group}>
                            <HStack style={[styles.row, { borderTopWidth: 0 }]}>
                                <Text style={styles.rowLabel}>
                                    {t('coach.build.goal', { ns: 'screens' })}
                                </Text>
                                <MenuPicker
                                    value={goal}
                                    options={GOALS.map((value) => ({
                                        value,
                                        label: t(`onboarding.goal.${value}`, { ns: 'screens' }),
                                    }))}
                                    onChange={setGoal}
                                    accessibilityLabel={t('coach.build.goal', { ns: 'screens' })}
                                />
                            </HStack>
                            <HStack style={styles.row}>
                                <Text style={styles.rowLabel}>
                                    {t('coach.build.place', { ns: 'screens' })}
                                </Text>
                                <MenuPicker
                                    value={place}
                                    options={PLACES.map((value) => ({
                                        value,
                                        label: t(`onboarding.trainingEnvironment.${value}`, {
                                            ns: 'screens',
                                        }),
                                    }))}
                                    onChange={setPlace}
                                    accessibilityLabel={t('coach.build.place', { ns: 'screens' })}
                                />
                            </HStack>
                            <HStack style={styles.row}>
                                <Text style={styles.rowLabel}>
                                    {t('coach.build.injuries', { ns: 'screens' })}
                                </Text>
                                <MenuPicker
                                    value={hasInjuries ? 'some' : 'none'}
                                    options={[
                                        {
                                            value: 'none',
                                            label: t('coach.build.injuriesNone', { ns: 'screens' }),
                                        },
                                        {
                                            value: 'some',
                                            label: t('coach.build.injuriesSome', { ns: 'screens' }),
                                        },
                                    ]}
                                    onChange={(value) => setInjured(value === 'some')}
                                    accessibilityLabel={t('coach.build.injuries', {
                                        ns: 'screens',
                                    })}
                                />
                            </HStack>
                            {hasInjuries ? (
                                <Input
                                    style={styles.input}
                                    value={conditionsText}
                                    onChangeText={setConditions}
                                    placeholder={t('coach.build.injuriesPlaceholder', {
                                        ns: 'screens',
                                    })}
                                    maxLength={200}
                                    accessibilityLabel={t('coach.build.injuries', {
                                        ns: 'screens',
                                    })}
                                />
                            ) : null}
                        </VStack>
                    </>
                )}
            </ScrollView>

            <VStack style={styles.footer}>
                {step === 'review' ? (
                    <Text style={styles.footerText}>
                        {!available
                            ? t('syn.unavailable.message', { ns: 'screens' })
                            : signInNeeded
                              ? t('syn.signInRequired.message', { ns: 'screens' })
                              : exhausted
                                ? t('coach.new.usedUp', { ns: 'screens', limit: quota.limit })
                                : isBusy
                                  ? t('coach.new.busy', { ns: 'screens' })
                                  : t('coach.new.cost', { ns: 'screens', count: quota.remaining })}
                    </Text>
                ) : null}
                <Button
                    type="primary"
                    title={t(step === 'build' ? 'coach.build.review' : 'coach.build.create', {
                        ns: 'screens',
                    })}
                    disabled={step === 'build' ? !canReview : !canCreate}
                    onPress={step === 'build' ? openReview : () => void create()}
                />
            </VStack>

            <SessionSheet
                key={sheet ? `${sheet.day}-${sheet.index}` : 'closed'}
                day={sheet ? weekdayName(sheet.day) : null}
                initial={
                    sheet && sheet.index !== null
                        ? plan.schedule[sheet.day]?.[sheet.index]
                        : undefined
                }
                onCancel={() => setSheet(null)}
                onSave={(session) => {
                    if (!sheet) return;
                    updateDay(sheet.day, (sessions) => {
                        if (sheet.index === null) sessions.push(session);
                        else sessions[sheet.index] = session;
                        return sessions;
                    });
                    setSheet(null);
                }}
                onRemove={
                    sheet && sheet.index !== null
                        ? () => {
                              updateDay(sheet.day, (sessions) =>
                                  sessions.filter((_, i) => i !== sheet.index),
                              );
                              setSheet(null);
                          }
                        : undefined
                }
            />
        </Box>
    );
};

export default BuildPlanScreen;
