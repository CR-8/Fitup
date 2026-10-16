import { useCallback, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';

import { useApplyAiPlan, usePlanById } from '@/hooks/use-ai';
import { usePlanDiff } from '@/hooks/use-plan-diff';
import { useMergePreviewStore } from '@/stores/merge-preview';
import { useSynDraftStore } from '@/stores/syn-draft';
import { useUndoToastStore } from '@/stores/undo-toast';

/**
 * State and actions of the "Preview changes" sheet, shared by both platforms'
 * views. Each diff row has a toggle (on by default); "Add N changes" applies
 * exactly the rows left on, then offers a ten-second undo.
 */
export const useMergePreview = () => {
    const { t } = useTranslation('screens');
    const planId = useMergePreviewStore((state) => state.planId);
    const close = useMergePreviewStore((state) => state.close);
    const plan = usePlanById(planId);
    const { rows } = usePlanDiff(plan);
    const { apply, revert, isApplying } = useApplyAiPlan();
    const showUndo = useUndoToastStore((state) => state.show);
    const setDraft = useSynDraftStore((state) => state.setDraft);

    // Toggled-off rows belong to one plan: opening another starts with all on.
    const [offState, setOffState] = useState<{ planId?: string; keys: Set<string> }>({
        keys: new Set(),
    });
    const off = useMemo(
        () => (offState.planId === planId ? offState.keys : new Set<string>()),
        [offState, planId],
    );

    const actionable = useMemo(() => rows.filter((row) => row.kind !== 'unchanged'), [rows]);
    const selected = useMemo(
        () => actionable.filter((row) => !off.has(row.key)),
        [actionable, off],
    );

    const toggle = useCallback(
        (key: string, value: boolean) =>
            setOffState((prev) => {
                const keys = new Set(prev.planId === planId ? prev.keys : []);
                if (value) keys.delete(key);
                else keys.add(key);

                return { planId, keys };
            }),
        [planId],
    );

    const mealCount = plan?.payload.meals.filter((meal) => meal.items.length > 0).length ?? 0;
    const canApply = !!plan && (selected.length > 0 || mealCount > 0) && !isApplying;

    const confirm = useCallback(async () => {
        if (!plan || !canApply) return;

        try {
            await apply({ plan, rows: selected });
            close();
            showUndo(t('syn.preview.added', { count: selected.length }), () => {
                revert(plan).catch(() => Alert.alert(t('syn.plan.revertFailed')));
            });
        } catch {
            Alert.alert(t('syn.plan.applyFailed'));
        }
    }, [apply, canApply, close, plan, revert, selected, showUndo, t]);

    const askForChanges = useCallback(() => {
        if (plan) setDraft(t('syn.preview.askDraft', { title: plan.payload.title }));
        close();
        router.navigate('/syn');
    }, [close, plan, setDraft, t]);

    return {
        plan,
        rows: actionable,
        off,
        toggle,
        selectedCount: selected.length,
        mealCount,
        canApply,
        isApplying,
        confirm,
        askForChanges,
        close,
    };
};
