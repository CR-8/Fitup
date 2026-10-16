import { FC } from 'react';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';

import { HStack } from '@/components/primitives/hstack';
import { Text } from '@/components/primitives/text';
import { VStack } from '@/components/primitives/vstack';
import { getPersonalBests } from '@/crud/workout';
import { exerciseDisplayName } from '@/helpers/exercise-name';
import { convertWeight } from '@/helpers/units';
import { useUser } from '@/hooks/use-user';

const styles = StyleSheet.create((theme) => ({
    section: {
        gap: theme.space(3),
    },
    title: {
        ...theme.fontSize['2xl'],
        fontWeight: theme.fontWeight.bold.fontWeight,
        color: theme.solid.typography,
    },
    card: {
        backgroundColor: theme.solid.foreground,
        borderRadius: theme.radius['4xl'],
        borderCurve: 'continuous',
        padding: theme.space(4),
        gap: theme.space(3),
    },
    row: {
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.space(3),
        minHeight: theme.space(11),
    },
    text: {
        flex: 1,
        gap: theme.space(0.5),
    },
    name: {
        ...theme.fontSize.default,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: theme.solid.typography,
    },
    when: {
        ...theme.fontSize.sm,
        color: theme.solid.mutedTypography,
    },
    value: {
        fontSize: 24,
        lineHeight: 28,
        color: theme.solid.typography,
        ...theme.typography.metric,
    },
    divider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: theme.solid.border,
    },
    empty: {
        ...theme.fontSize.default,
        color: theme.solid.mutedTypography,
    },
}));

/** The heaviest estimated lift per exercise, newest record first. */
export const PersonalBests: FC = () => {
    const { t, i18n } = useTranslation('screens');
    const { user } = useUser();
    const units = user?.weightUnits ?? 'kg';

    const { data: bests = [] } = useQuery({
        queryKey: ['personal-bests'],
        queryFn: () => getPersonalBests(5),
    });

    return (
        <VStack style={styles.section}>
            <Text style={styles.title}>{t('results.personalBests.title')}</Text>
            <VStack style={styles.card}>
                {bests.length === 0 ? (
                    <Text style={styles.empty}>{t('results.personalBests.empty')}</Text>
                ) : (
                    bests.map((best, index) => {
                        const weight = convertWeight(best.weight, best.weightUnits, units);

                        return (
                            <VStack key={best.exerciseId} style={{ gap: 12 }}>
                                {index > 0 ? <VStack style={styles.divider} /> : null}
                                <HStack style={styles.row}>
                                    <VStack style={styles.text}>
                                        <Text style={styles.name} numberOfLines={1}>
                                            {exerciseDisplayName({
                                                name: best.name,
                                                userId: best.userId,
                                            })}
                                        </Text>
                                        <Text style={styles.when}>
                                            {dayjs(best.achievedAt)
                                                .locale(i18n.language)
                                                .format('D MMM YYYY')}
                                        </Text>
                                    </VStack>
                                    <Text style={styles.value}>
                                        {`${Math.round(weight * 10) / 10} ${units} × ${best.reps}`}
                                    </Text>
                                </HStack>
                            </VStack>
                        );
                    })
                )}
            </VStack>
        </VStack>
    );
};
