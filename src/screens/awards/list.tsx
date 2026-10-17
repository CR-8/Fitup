import { FC } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';

import { ScrollView } from '@/components/primitives/scrollview';
import { Box } from '@/components/primitives/box';
import { ModalHeader, modalStyles } from '@/components/layout/modal-header';
import { useTodayKey } from '@/hooks/use-water';

import { AwardTile } from './components/tile';
import { useAwards } from './data';

/** One group of awards as a grid with progress: Go For It (`go`), or a group by name. */

const styles = StyleSheet.create((theme) => ({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginHorizontal: -theme.space(1),
    },
}));

const AwardListScreen: FC = () => {
    const { t } = useTranslation(['screens']);
    const { group } = useLocalSearchParams<{ group: string }>();
    const today = useTodayKey();
    const { all, goForIt } = useAwards(today);
    const go = group === 'go';
    const awards = go ? goForIt : all.filter((award) => award.group === group);

    return (
        <ScrollView style={styles.container} contentContainerStyle={modalStyles.content}>
            <ModalHeader
                title={t(go ? 'awards.goForIt' : `awards.groups.${group}`, { ns: 'screens' })}
                subtitle={go ? t('awards.goForItBody', { ns: 'screens' }) : undefined}
                done={false}
            />
            <Box style={styles.grid}>
                {awards.map((award) => (
                    <AwardTile key={award.id} award={award} size={100} progress />
                ))}
            </Box>
        </ScrollView>
    );
};

export default AwardListScreen;
