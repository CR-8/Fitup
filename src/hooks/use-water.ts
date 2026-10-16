import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { addWaterLog, deleteWaterLog, getWaterLogsForDate } from '@/crud/water';
import { toDateKey } from '@/crud/nutrition';
import type { WaterLogSelect } from '@/db/schema';
import { DEFAULT_WATER_GLASS_ML, DEFAULT_WATER_TARGET_ML } from '@/constants/water';
import { nanoid } from '@/helpers/nanoid';
import { reportError } from '@/services/error-reporting';
import { useUndoToastStore } from '@/stores/undo-toast';

import { useAppState } from './use-app-state';
import { useUser } from './use-user';

const WATER_KEY = 'water-logs';

/**
 * Today's `YYYY-MM-DD`, kept current: it moves on at local midnight while the
 * app is open, and is re-read whenever the app comes back to the foreground, so
 * a screen left open overnight does not keep logging into yesterday.
 */
export const useTodayKey = (): string => {
    const [today, setToday] = useState(() => toDateKey());

    const refresh = useCallback(() => setToday(toDateKey()), []);
    useAppState({ onForeground: refresh });

    useEffect(() => {
        const now = new Date();
        const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        const timeout = setTimeout(refresh, midnight.getTime() - now.getTime() + 1000);

        return () => clearTimeout(timeout);
    }, [refresh, today]);

    return today;
};

/** "5" for whole glasses, "5.2" otherwise. */
export const formatGlasses = (glasses: number): string =>
    Number.isInteger(glasses) ? String(glasses) : glasses.toFixed(1);

/** "750 ml" under a litre, "1.25 L" from there. */
export const formatWater = (ml: number): string =>
    ml < 1000 ? `${Math.round(ml)} ml` : `${Number((ml / 1000).toFixed(2))} L`;

export const useWaterSettings = () => {
    const { user, updateUser, isUpdating } = useUser();

    return {
        targetMl: user?.waterTargetMl ?? DEFAULT_WATER_TARGET_ML,
        glassMl: user?.waterGlassMl ?? DEFAULT_WATER_GLASS_ML,
        isDefaultTarget: user?.waterTargetMl == null,
        save: (updates: { waterTargetMl?: number; waterGlassMl?: number }) => updateUser(updates),
        isSaving: isUpdating,
    };
};

/** One day's water: the entries, the total, and how it stands against the goal. */
export const useWaterDay = (date: string) => {
    const { user } = useUser();
    const { targetMl, glassMl, isDefaultTarget } = useWaterSettings();

    const { data, isLoading, isError, refetch } = useQuery({
        queryKey: [WATER_KEY, user?.id, date],
        queryFn: () => getWaterLogsForDate(user!.id, date),
        enabled: !!user?.id,
    });

    const logs = data ?? [];
    const totalMl = logs.reduce((sum, log) => sum + log.amountMl, 0);

    return {
        logs,
        totalMl,
        targetMl,
        glassMl,
        isDefaultTarget,
        glasses: Math.round((totalMl / glassMl) * 10) / 10,
        targetGlasses: Math.ceil(targetMl / glassMl),
        progress: targetMl > 0 ? totalMl / targetMl : 0,
        isLoading: isLoading && !data,
        isError,
        refetch,
    };
};

/**
 * Logging and removing drinks. Both are optimistic: the day's total moves on
 * the tap, then the write is reconciled; a failed write puts the day back and
 * says so. With `undoToast`, an add offers Undo (which also covers a double tap).
 */
export const useWaterLogging = ({ undoToast = false }: { undoToast?: boolean } = {}) => {
    const { t } = useTranslation(['screens']);
    const { user } = useUser();
    const queryClient = useQueryClient();
    const showUndo = useUndoToastStore((state) => state.show);

    const keyFor = (date: string) => [WATER_KEY, user?.id, date];

    const remove = useMutation({
        mutationFn: ({ id }: { id: string; date: string }) => deleteWaterLog(id),
        onMutate: async ({ id, date }) => {
            await queryClient.cancelQueries({ queryKey: keyFor(date) });
            const previous = queryClient.getQueryData<WaterLogSelect[]>(keyFor(date));
            queryClient.setQueryData<WaterLogSelect[]>(keyFor(date), (logs) =>
                (logs ?? []).filter((log) => log.id !== id),
            );

            return { previous };
        },
        onError: (error, { date }, context) => {
            queryClient.setQueryData(keyFor(date), context?.previous);
            reportError(error, 'Failed to remove a water entry:');
            Alert.alert(t('hydration.errors.remove', { ns: 'screens' }));
        },
        onSettled: (_, __, { date }) => queryClient.invalidateQueries({ queryKey: keyFor(date) }),
    });

    const add = useMutation({
        mutationFn: (input: { id: string; date: string; amountMl: number }) =>
            addWaterLog({ ...input, userId: user!.id }),
        onMutate: async ({ id, date, amountMl }) => {
            await queryClient.cancelQueries({ queryKey: keyFor(date) });
            const previous = queryClient.getQueryData<WaterLogSelect[]>(keyFor(date));
            queryClient.setQueryData<WaterLogSelect[]>(keyFor(date), (logs) => [
                ...(logs ?? []),
                { id, userId: user!.id, date, amountMl, createdAt: new Date() },
            ]);

            return { previous };
        },
        onSuccess: (_, { id, date, amountMl }) => {
            if (!undoToast) return;

            showUndo(t('hydration.added', { ns: 'screens', amount: formatWater(amountMl) }), () =>
                remove.mutate({ id, date }),
            );
        },
        onError: (error, { date }, context) => {
            queryClient.setQueryData(keyFor(date), context?.previous);
            reportError(error, 'Failed to log water:');
            Alert.alert(t('hydration.errors.add', { ns: 'screens' }));
        },
        onSettled: (_, __, { date }) => queryClient.invalidateQueries({ queryKey: keyFor(date) }),
    });

    return {
        addWater: (date: string, amountMl: number) => {
            if (!user?.id) return;
            add.mutate({ id: nanoid(), date, amountMl });
        },
        removeWater: (date: string, id: string) => remove.mutate({ id, date }),
    };
};
