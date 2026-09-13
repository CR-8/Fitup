import { FC } from 'react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { Heart } from 'lucide-react-native';

import { useFavoriteExerciseIds, useToggleFavoriteExercise } from '@/hooks/use-exercises';

import { Pressable } from '../primitives/pressable';

interface FavoriteButtonProps {
    exerciseId: string;
    size?: number;
}

const styles = StyleSheet.create((theme) => ({
    // A hit area larger than the glyph: in a list row the heart is small, and a
    // miss opens the exercise instead.
    hit: {
        padding: theme.space(2),
    },
}));

/**
 * The heart, for one exercise, owning its own state.
 *
 * It reads the favourites set itself rather than taking `favorite` as a prop,
 * so toggling re-renders this glyph and nothing around it — the list rows it
 * sits in are memoised and would otherwise all redraw on every tap.
 */
export const FavoriteButton: FC<FavoriteButtonProps> = ({ exerciseId, size }) => {
    const { t } = useTranslation(['screens']);
    const { theme } = useUnistyles();
    const favorites = useFavoriteExerciseIds();
    const { mutate: toggle } = useToggleFavoriteExercise();

    const active = favorites.has(exerciseId);

    return (
        <Pressable
            style={styles.hit}
            onPress={() => toggle(exerciseId)}
            hitSlop={theme.space(2)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={t(active ? 'exercises.unfavorite' : 'exercises.favorite', {
                ns: 'screens',
            })}
        >
            <Heart
                size={size ?? theme.space(5)}
                strokeWidth={2}
                color={active ? theme.colors.primary : theme.colors.mutedTypography}
                fill={active ? theme.colors.primary : 'transparent'}
            />
        </Pressable>
    );
};
