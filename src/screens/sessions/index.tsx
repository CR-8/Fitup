import { FC, useState } from 'react';
import { Alert, View } from 'react-native';
import { router } from 'expo-router';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';

import { ModalHeader } from '@/components/layout/modal-header';
import { useDeleteWorkout } from '@/hooks/use-workouts';

import { SessionList } from './components/list';
import { ALL, WORKOUTS, useSessions } from './data';

/**
 * Every finished session, after Apple Fitness's Sessions: filters (All,
 * Workouts, then each workout by name), months newest first, a row per
 * session that opens it and swipes to Delete.
 */

const styles = StyleSheet.create((theme) => ({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
}));

const SessionsScreen: FC = () => {
    const { t, i18n } = useTranslation(['screens', 'common']);
    const [filter, setFilter] = useState(ALL);
    const { names, groups } = useSessions(filter, i18n.language);
    const deleteWorkout = useDeleteWorkout();

    const confirmDelete = (id: string) =>
        Alert.alert(
            t('sessions.deleteTitle', { ns: 'screens' }),
            t('sessions.deleteBody', { ns: 'screens' }),
            [
                { text: t('cancel', { ns: 'common' }), style: 'cancel' },
                {
                    text: t('sessions.deleteConfirm', { ns: 'screens' }),
                    style: 'destructive',
                    onPress: () => deleteWorkout.mutate(id),
                },
            ],
        );

    return (
        <View style={styles.container}>
            <SessionList
                header={<ModalHeader title={t('sessions.title', { ns: 'screens' })} done={false} />}
                chips={[
                    { key: ALL, label: t('sessions.all', { ns: 'screens' }) },
                    { key: WORKOUTS, label: t('sessions.workouts', { ns: 'screens' }) },
                    ...names.map((name) => ({ key: name, label: name })),
                ]}
                selected={filter}
                onSelect={setFilter}
                groups={groups}
                labels={{
                    empty: t('sessions.empty', { ns: 'screens' }),
                    delete: t('delete', { ns: 'common' }),
                    total: t('sessions.total', { ns: 'screens' }),
                    average: t('sessions.average', { ns: 'screens' }),
                    workouts: t('sessions.workouts', { ns: 'screens' }),
                    time: t('sessions.time', { ns: 'screens' }),
                    kcal: t('sessions.kcal', { ns: 'screens' }),
                }}
                onOpen={(id) =>
                    router.navigate({
                        pathname: '/session/[workoutId]',
                        params: { workoutId: id },
                    } as never)
                }
                onDelete={confirmDelete}
            />
        </View>
    );
};

export default SessionsScreen;
