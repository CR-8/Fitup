import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native-unistyles';

import { Text } from '@/components/primitives/text';
import { VStack } from '@/components/primitives/vstack';
import { isCatalogueSeeded, isExerciseApiConfigured } from '@/services/exercise-catalogue';

const styles = StyleSheet.create((theme, rt) => ({
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: theme.space(8),
        paddingBottom: rt.insets.bottom + theme.space(25),
        gap: theme.space(2),
    },
    emptyTitle: {
        color: theme.colors.typography,
        fontSize: theme.fontSize.xl.fontSize,
        fontWeight: theme.fontWeight.bold.fontWeight,
    },
    emptyDescription: {
        color: theme.colors.typography,
        opacity: 0.6,
        textAlign: 'center',
    },
}));

/**
 * Why the list is empty decides what to say about it.
 *
 * The catalogue is fetched rather than bundled, so "no exercises" now has three
 * causes that look identical on screen and need different responses from the
 * user. Telling someone to create their first exercise when the real problem is
 * that the library has not downloaded yet sends them to build by hand what they
 * would have had in a moment on a working connection.
 */
const resolveReason = (): 'unavailable' | 'notDownloaded' | 'none' => {
    if (!isExerciseApiConfigured()) return 'unavailable';
    if (!isCatalogueSeeded()) return 'notDownloaded';

    return 'none';
};

const EmptyState: FC = () => {
    const { t } = useTranslation(['screens']);
    const reason = resolveReason();

    // `none` means the catalogue is present and something else — a search or a
    // filter — emptied the list, which is the case the original copy was for.
    const key = reason === 'none' ? 'empty' : `empty.${reason}`;

    return (
        <VStack style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>{t(`exercises.${key}.title`, { ns: 'screens' })}</Text>
            <Text style={styles.emptyDescription}>
                {t(`exercises.${key}.description`, { ns: 'screens' })}
            </Text>
        </VStack>
    );
};

export { EmptyState };
