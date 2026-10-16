import { FC } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';

import { ScrollView } from '@/components/primitives/scrollview';
import { ModalHeader, modalStyles } from '@/components/layout/modal-header';
import { usePlanById } from '@/hooks/use-ai';
import { PlanCard } from '@/screens/syn/components/plan-card';

/**
 * One saved plan, outside the thread: the same card, so reviewing, previewing
 * the changes, adding it and undoing it all work exactly as they do in Coach.
 */

const styles = StyleSheet.create(() => ({
    container: {
        flex: 1,
    },
}));

const PlanScreen: FC = () => {
    const { t } = useTranslation(['screens']);
    const { planId } = useLocalSearchParams<{ planId: string }>();
    const plan = usePlanById(planId);

    return (
        <ScrollView style={styles.container} contentContainerStyle={modalStyles.content}>
            <ModalHeader
                title={t(`coach.plans.kind.${plan?.kind ?? 'workout'}`, { ns: 'screens' })}
                done={false}
            />
            {plan ? <PlanCard plan={plan} /> : null}
        </ScrollView>
    );
};

export default PlanScreen;
