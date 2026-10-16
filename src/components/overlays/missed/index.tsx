import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { BottomSheet, Column, List, ListItem, Text } from '@expo/ui';

import { brandTint } from '@/components/native/modifiers';
import { MISSED_OPTIONS, useMissedSession } from '@/hooks/use-missed-session';

/**
 * "You missed a session". Nothing is preselected: the user picks, and the pick
 * is applied at once. Dismissing leaves the workout where it was.
 */
const MissedSessionSheet: FC = () => {
    const { t } = useTranslation(['screens']);
    const { workoutId, workout, choose, close } = useMissedSession();

    return (
        <BottomSheet
            isPresented={!!workoutId}
            onDismiss={close}
            snapPoints={['half']}
            modifiers={brandTint}
        >
            <Column spacing={8}>
                <Text textStyle={{ fontSize: 20, fontWeight: '600' }}>
                    {t('missed-session.title')}
                </Text>
                <Text>{t('missed-session.subtitle', { name: workout?.name ?? '' })}</Text>
                <List>
                    {MISSED_OPTIONS.map((option) => (
                        <ListItem
                            key={option}
                            supportingText={t(`missed-session.${option}Hint`)}
                            onPress={() => void choose(option)}
                        >
                            {t(`missed-session.${option}`)}
                        </ListItem>
                    ))}
                </List>
            </Column>
        </BottomSheet>
    );
};

export default MissedSessionSheet;
