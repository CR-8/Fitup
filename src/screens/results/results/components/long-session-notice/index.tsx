import { FC, useCallback, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/buttons/base';
import { Text } from '@/components/primitives/text';
import { VStack } from '@/components/primitives/vstack';
import { HStack } from '@/components/primitives/hstack';
import { getWorkoutLastActivity } from '@/crud/workout';
import { IMPLAUSIBLE_DURATION_SEC } from '@/helpers/workout-activity';
import { formatWorkoutDuration } from '@/helpers/times';
import { useEditor } from '@/hooks/use-editor';
import { useUpdateWorkout, useWorkouts } from '@/hooks/use-workouts';
import { reportError } from '@/services/error-reporting';
import { storage } from '@/storage';

const DISMISSED_KEY = 'long-session-notice:dismissed';

const readDismissed = (): string[] => {
    try {
        return JSON.parse(storage.getString(DISMISSED_KEY) ?? '[]') as string[];
    } catch {
        return [];
    }
};

const styles = StyleSheet.create((theme) => ({
    container: {
        gap: theme.space(3),
        backgroundColor: theme.colors.foreground,
        borderRadius: theme.radius['3xl'],
        borderWidth: 1,
        borderColor: theme.colors.border,
        padding: theme.space(4),
    },
    title: {
        ...theme.fontSize.default,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: theme.colors.typography,
    },
    body: {
        ...theme.fontSize.sm,
        color: theme.colors.mutedTypography,
    },
    actions: {
        gap: theme.space(3),
    },
    action: {
        flex: 1,
    },
}));

/**
 * Completed sessions logged as longer than four hours are almost always a
 * workout left running overnight. History is never rewritten silently: this
 * offers to end the session at its last logged set, or to edit it by hand, and
 * the edit goes through `updateWorkout` so it syncs like any other.
 */
export const LongSessionNotice: FC = () => {
    const { t } = useTranslation(['screens', 'common']);
    const { data: workouts } = useWorkouts();
    const { mutateAsync: updateWorkout } = useUpdateWorkout();
    const { navigate } = useEditor();
    const [dismissed, setDismissed] = useState(readDismissed);

    const long = useMemo(
        () =>
            (workouts ?? []).filter(
                (workout) =>
                    workout.status === 'completed' &&
                    (workout.duration ?? 0) > IMPLAUSIBLE_DURATION_SEC &&
                    !dismissed.includes(workout.id),
            ),
        [dismissed, workouts],
    );
    const first = long[0];

    const dismiss = useCallback(() => {
        if (!first) return;
        const next = [...dismissed, first.id];
        storage.set(DISMISSED_KEY, JSON.stringify(next));
        setDismissed(next);
    }, [dismissed, first]);

    const fix = useCallback(async () => {
        if (!first) return;

        const lastActivity = await getWorkoutLastActivity(first.id).catch(() => null);
        const startedMs = first.startedAt ? new Date(first.startedAt).getTime() : null;
        const edit = {
            text: t('long-session.edit', { ns: 'screens' }),
            onPress: () => navigate({ type: 'workout__edit', payload: { workoutId: first.id } }),
        };
        const cancel = { text: t('cancel', { ns: 'common' }), style: 'cancel' as const };

        if (!lastActivity || startedMs == null || lastActivity.getTime() <= startedMs) {
            Alert.alert(first.name, undefined, [edit, cancel]);
            return;
        }

        const seconds = Math.floor((lastActivity.getTime() - startedMs) / 1000);
        Alert.alert(first.name, t('long-session.setToHint', { ns: 'screens' }), [
            {
                text: t('long-session.setTo', {
                    ns: 'screens',
                    duration: formatWorkoutDuration(seconds),
                }),
                onPress: () => {
                    void updateWorkout({
                        id: first.id,
                        updates: { completedAt: lastActivity },
                    }).catch((error) => reportError(error, 'Failed to repair workout duration:'));
                },
            },
            edit,
            cancel,
        ]);
    }, [first, navigate, t, updateWorkout]);

    if (!first) return null;

    return (
        <VStack style={styles.container}>
            <Text style={styles.title}>
                {t('long-session.title', { ns: 'screens', count: long.length })}
            </Text>
            <Text style={styles.body}>
                {t('long-session.body', {
                    ns: 'screens',
                    name: first.name,
                    duration: formatWorkoutDuration(first.duration ?? 0),
                })}
            </Text>
            <HStack style={styles.actions}>
                <Button
                    title={t('long-session.dismiss', { ns: 'screens' })}
                    containerStyle={styles.action}
                    onPress={dismiss}
                />
                <Button
                    type="primary"
                    title={t('long-session.fix', { ns: 'screens' })}
                    containerStyle={styles.action}
                    onPress={() => void fix()}
                />
            </HStack>
        </VStack>
    );
};
