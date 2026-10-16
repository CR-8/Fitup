import { FC, useState } from 'react';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';

import { Box } from '@/components/primitives/box';
import { VStack } from '@/components/primitives/vstack';
import { Text } from '@/components/primitives/text';
import { Input } from '@/components/primitives/input';
import { Pressable } from '@/components/primitives/pressable';
import { Button } from '@/components/buttons/base';
import { Card, CardTitle } from '@/components/layout/card';
import { ModalHeader, modalStyles } from '@/components/layout/modal-header';
import { ChoiceChips, type ChoiceOption } from '@/components/forms/choice-chips';
import { AI_CONFIG } from '@/constants/ai';
import type { AiProfileSelect } from '@/db/schema';
import { useAccount } from '@/hooks/use-account';
import { useAiAvailable, useAiProfile, useSynActions } from '@/hooks/use-ai';
import { storage } from '@/storage';

import { DietFields, type Diet } from './components/diet-fields';

/**
 * D02 / D05: what a plan build will be based on, before it spends anything.
 *
 * Profile answers are prefilled and, when changed here, saved back to the
 * profile on Build — so allergies and diet stay put for every later build and
 * swap. The rest (region, cooking time, budget, focus) goes into the request's
 * wording and is remembered on this device between visits.
 *
 * The bottom bar shows the cost and what is left before the one button that
 * spends it; there is no way to build from a single stray tap.
 */

type Kind = 'workout' | 'nutrition';
type Goal = NonNullable<AiProfileSelect['goal']>;
type Place = NonNullable<AiProfileSelect['trainingEnvironment']>;

const GOALS: Goal[] = ['lose', 'gain', 'maintain', 'recomp'];
const PLACES: Place[] = ['gym', 'home'];
const DAYS = [2, 3, 4, 5, 6];
const MINUTES = [30, 45, 60, 75, 90];
const REGIONS = ['north', 'south', 'west', 'east', 'mixed'] as const;
const COOK_TIMES = [15, 30, 45] as const;
const BUDGETS = ['low', 'moderate', 'flexible'] as const;

type Region = (typeof REGIONS)[number];
type Budget = (typeof BUDGETS)[number];

interface Draft {
    goal?: Goal | null;
    sessionsPerWeek?: number | null;
    sessionMinutes?: number | null;
    trainingEnvironment?: Place | null;
    focus?: string;
    dietaryPattern?: Diet | null;
    allergens?: string[];
    region?: Region;
    cookMinutes?: number;
    budget?: Budget;
}

const draftKey = (kind: Kind) => `coach.draft.${kind}`;

const readDraft = (kind: Kind): Draft => {
    try {
        const raw = storage.getString(draftKey(kind));
        return raw ? (JSON.parse(raw) as Draft) : {};
    } catch {
        return {};
    }
};

const styles = StyleSheet.create((theme, rt) => ({
    container: {
        flex: 1,
    },
    caution: {
        ...theme.fontSize.xs,
        color: theme.colors.mutedTypography,
    },
    input: {
        ...theme.fontSize.default,
        minHeight: 48,
        paddingHorizontal: theme.space(3),
        borderRadius: theme.radius.xl,
        backgroundColor: theme.colors.input,
        color: theme.colors.typography,
    },
    footer: {
        gap: theme.space(2),
        paddingHorizontal: theme.space(4),
        paddingTop: theme.space(3),
        paddingBottom: rt.insets.bottom + theme.space(3),
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: theme.colors.border,
        backgroundColor: theme.colors.background,
    },
    cost: {
        ...theme.fontSize.sm,
        textAlign: 'center',
        color: theme.colors.mutedTypography,
    },
    link: {
        ...theme.fontSize.sm,
        textAlign: 'center',
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: theme.colors.primary,
    },
}));

const NewPlanScreen: FC = () => {
    const { t } = useTranslation(['screens']);
    const { theme } = useUnistyles();
    const params = useLocalSearchParams<{ kind?: string }>();
    const kind: Kind = params.kind === 'nutrition' ? 'nutrition' : 'workout';

    const available = useAiAvailable();
    const { isSignedIn } = useAccount();
    const { profile, save } = useAiProfile();
    const { generate, quota, exhausted, isBusy } = useSynActions();

    const [draft, setDraftState] = useState<Draft>(() => readDraft(kind));
    const [submitting, setSubmitting] = useState(false);

    const setDraft = (updates: Draft) => {
        setDraftState((current) => {
            const next = { ...current, ...updates };
            try {
                storage.set(draftKey(kind), JSON.stringify(next));
            } catch {
                // A draft that cannot be remembered is still a usable form.
            }
            return next;
        });
    };

    // What the form shows: this visit's answer, else the profile's.
    const goal = draft.goal !== undefined ? draft.goal : (profile?.goal ?? null);
    const days =
        draft.sessionsPerWeek !== undefined
            ? draft.sessionsPerWeek
            : (profile?.sessionsPerWeek ?? null);
    const minutes =
        draft.sessionMinutes !== undefined
            ? draft.sessionMinutes
            : (profile?.sessionMinutes ?? null);
    const place =
        draft.trainingEnvironment !== undefined
            ? draft.trainingEnvironment
            : (profile?.trainingEnvironment ?? null);
    const diet =
        draft.dietaryPattern !== undefined
            ? draft.dietaryPattern
            : (profile?.dietaryPattern ?? null);
    const allergens = draft.allergens ?? profile?.allergens ?? [];
    const region = draft.region ?? 'north';
    const cookMinutes = draft.cookMinutes ?? 30;
    const budget = draft.budget ?? 'moderate';

    const signInNeeded = AI_CONFIG.transport === 'proxy' && !isSignedIn;
    const blocked = !available || signInNeeded;
    const canSubmit = !blocked && !exhausted && !isBusy && !submitting;

    const option = <T extends string | number>(value: T, label: string): ChoiceOption<T> => ({
        value,
        label,
    });
    const toggle = <T,>(current: T | null, value: T): T | null =>
        current === value ? null : value;

    const unknown = t('coach.new.unknown', { ns: 'screens' });

    const buildIntent = () => {
        if (kind === 'workout') {
            const intent = t('coach.new.workoutIntent', {
                ns: 'screens',
                goal: goal ? t(`onboarding.goal.${goal}`, { ns: 'screens' }) : unknown,
                days: days ?? unknown,
                minutes: minutes ?? unknown,
                place: place
                    ? t(`onboarding.trainingEnvironment.${place}`, { ns: 'screens' })
                    : unknown,
            });
            const focus = draft.focus?.trim();

            return focus
                ? `${intent} ${t('coach.new.focusIntent', { ns: 'screens', focus })}`
                : intent;
        }

        return t('coach.new.mealIntent', {
            ns: 'screens',
            region: t(`coach.new.regions.${region}`, { ns: 'screens' }),
            minutes: cookMinutes,
            budget: t(`coach.new.budgets.${budget}`, { ns: 'screens' }),
        });
    };

    const handleBuild = async () => {
        if (!canSubmit) return;
        setSubmitting(true);

        try {
            // Saved first, so the request is built from the answers just given.
            await save(
                kind === 'workout'
                    ? {
                          goal,
                          sessionsPerWeek: days,
                          sessionMinutes: minutes,
                          trainingEnvironment: place,
                      }
                    : { dietaryPattern: diet, allergens },
            );
        } catch {
            // The build still runs on what the profile already had.
        }

        const started = generate(kind, buildIntent());
        setSubmitting(false);

        if (started) router.back();
    };

    const title = t(kind === 'workout' ? 'coach.new.workoutTitle' : 'coach.new.mealTitle', {
        ns: 'screens',
    });

    return (
        <Box style={styles.container}>
            <KeyboardAwareScrollView
                style={styles.container}
                contentContainerStyle={modalStyles.content}
                contentInsetAdjustmentBehavior="automatic"
                keyboardShouldPersistTaps="handled"
                bottomOffset={theme.space(6)}
            >
                <ModalHeader
                    title={title}
                    subtitle={t(
                        kind === 'workout' ? 'coach.new.workoutSubtitle' : 'coach.new.mealSubtitle',
                        { ns: 'screens' },
                    )}
                />

                {kind === 'workout' ? (
                    <>
                        <Card>
                            <CardTitle title={t('onboarding.fields.goal', { ns: 'screens' })} />
                            <ChoiceChips
                                options={GOALS.map((value) =>
                                    option(value, t(`onboarding.goal.${value}`, { ns: 'screens' })),
                                )}
                                selected={goal ? [goal] : []}
                                onToggle={(value) => setDraft({ goal: toggle(goal, value) })}
                            />
                        </Card>

                        <Card>
                            <CardTitle title={t('onboarding.fields.sessions', { ns: 'screens' })} />
                            <ChoiceChips
                                options={DAYS.map((value) => option(value, String(value)))}
                                selected={days ? [days] : []}
                                onToggle={(value) =>
                                    setDraft({ sessionsPerWeek: toggle(days, value) })
                                }
                            />
                            <CardTitle title={t('coach.new.minutes', { ns: 'screens' })} />
                            <ChoiceChips
                                options={MINUTES.map((value) =>
                                    option(
                                        value,
                                        t('coach.new.minutesValue', {
                                            ns: 'screens',
                                            count: value,
                                        }),
                                    ),
                                )}
                                selected={minutes ? [minutes] : []}
                                onToggle={(value) =>
                                    setDraft({ sessionMinutes: toggle(minutes, value) })
                                }
                            />
                        </Card>

                        <Card>
                            <CardTitle
                                title={t('onboarding.fields.trainingEnvironment', {
                                    ns: 'screens',
                                })}
                            />
                            <ChoiceChips
                                options={PLACES.map((value) =>
                                    option(
                                        value,
                                        t(`onboarding.trainingEnvironment.${value}`, {
                                            ns: 'screens',
                                        }),
                                    ),
                                )}
                                selected={place ? [place] : []}
                                onToggle={(value) =>
                                    setDraft({ trainingEnvironment: toggle(place, value) })
                                }
                            />
                        </Card>

                        <Card>
                            <CardTitle title={t('coach.new.focus', { ns: 'screens' })} />
                            <Input
                                style={styles.input}
                                value={draft.focus ?? ''}
                                onChangeText={(focus) => setDraft({ focus })}
                                placeholder={t('coach.new.focusPlaceholder', { ns: 'screens' })}
                                maxLength={200}
                                returnKeyType="done"
                                accessibilityLabel={t('coach.new.focus', { ns: 'screens' })}
                            />
                        </Card>
                    </>
                ) : (
                    <>
                        <DietFields diet={diet} allergens={allergens} onChange={setDraft} />

                        <Card>
                            <CardTitle title={t('coach.new.region', { ns: 'screens' })} />
                            <ChoiceChips
                                options={REGIONS.map((value) =>
                                    option(
                                        value,
                                        t(`coach.new.regions.${value}`, { ns: 'screens' }),
                                    ),
                                )}
                                selected={[region]}
                                onToggle={(value) => setDraft({ region: value })}
                            />
                        </Card>

                        <Card>
                            <CardTitle title={t('coach.new.cooking', { ns: 'screens' })} />
                            <ChoiceChips
                                options={COOK_TIMES.map((value) =>
                                    option<number>(
                                        value,
                                        t('coach.new.cookingValue', {
                                            ns: 'screens',
                                            count: value,
                                        }),
                                    ),
                                )}
                                selected={[cookMinutes]}
                                onToggle={(value) => setDraft({ cookMinutes: value })}
                            />
                            <CardTitle title={t('coach.new.budget', { ns: 'screens' })} />
                            <ChoiceChips
                                options={BUDGETS.map((value) =>
                                    option(
                                        value,
                                        t(`coach.new.budgets.${value}`, { ns: 'screens' }),
                                    ),
                                )}
                                selected={[budget]}
                                onToggle={(value) => setDraft({ budget: value })}
                            />
                        </Card>

                        <Text style={styles.caution}>
                            {t('coach.new.mealCaution', { ns: 'screens' })}
                        </Text>
                    </>
                )}

                <Text style={styles.caution}>{t('coach.new.review', { ns: 'screens' })}</Text>
            </KeyboardAwareScrollView>

            <VStack style={styles.footer}>
                {blocked ? (
                    <Text style={styles.cost}>
                        {t(
                            signInNeeded ? 'syn.signInRequired.message' : 'syn.unavailable.message',
                            {
                                ns: 'screens',
                            },
                        )}
                    </Text>
                ) : exhausted ? (
                    <Text style={styles.cost}>
                        {t('coach.new.usedUp', { ns: 'screens', limit: quota.limit })}
                    </Text>
                ) : (
                    <Text style={styles.cost}>
                        {t('coach.new.cost', { ns: 'screens', count: quota.remaining })}
                    </Text>
                )}

                {signInNeeded ? (
                    <Button
                        type="primary"
                        title={t('syn.signInRequired.action', { ns: 'screens' })}
                        onPress={() => router.navigate('/sign-in')}
                    />
                ) : (
                    <Button
                        type="primary"
                        title={t('coach.new.build', { ns: 'screens' })}
                        disabled={!canSubmit}
                        loading={submitting}
                        onPress={() => void handleBuild()}
                        accessibilityState={{ disabled: !canSubmit }}
                    />
                )}

                {exhausted ? (
                    <Pressable
                        onPress={() => router.navigate('/quota' as never)}
                        accessibilityRole="button"
                    >
                        <Text style={styles.link}>{t('quota.open', { ns: 'screens' })}</Text>
                    </Pressable>
                ) : isBusy ? (
                    <Text style={styles.cost}>{t('coach.new.busy', { ns: 'screens' })}</Text>
                ) : null}
            </VStack>
        </Box>
    );
};

export default NewPlanScreen;
