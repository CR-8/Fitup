import { FC } from 'react';
import { ScrollView } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Image as ExpoImage } from 'expo-image';

import { Box } from '@/components/primitives/box';
import { VStack } from '@/components/primitives/vstack';
import { Text } from '@/components/primitives/text';
import { Pressable } from '@/components/primitives/pressable';
import type { ExerciseListSelect } from '@/crud/exercise';
import { buildExerciseGifUrl, EXERCISE_GIF_THUMBNAIL_RESOLUTION } from '@/constants/fitup';
import { exerciseDisplayName } from '@/helpers/exercise-name';

/**
 * A titled, horizontally scrolling row of exercises — Favourites and Recently
 * Used above the library, as on the design board.
 *
 * Rows, not new list sections: a real section would be a new item type threaded
 * through the sticky header, the collapse state and the search index. As a list
 * header this needs none of that, and scrolls away with the list.
 */

const styles = StyleSheet.create((theme) => ({
    container: {
        gap: theme.space(2.5),
        marginBottom: theme.space(4),
    },
    title: {
        ...theme.fontSize.default,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: theme.colors.typography,
        paddingHorizontal: theme.space(4),
    },
    row: {
        paddingHorizontal: theme.space(4),
        gap: theme.space(2.5),
    },
    card: {
        width: theme.space(22),
        gap: theme.space(1.5),
    },
    image: {
        width: theme.space(22),
        height: theme.space(22),
        borderRadius: theme.radius['2xl'],
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: theme.colors.border,
        // The GIFs carry their own white ground; this keeps an unloaded tile
        // from flashing the page colour first.
        backgroundColor: theme.colors.white,
        overflow: 'hidden',
    },
    name: {
        ...theme.fontSize.xs,
        color: theme.colors.typography,
        textAlign: 'center',
    },
}));

interface ShelfProps {
    title: string;
    exercises: ExerciseListSelect[];
    onPress: (exerciseId: string) => void;
}

export const Shelf: FC<ShelfProps> = ({ title, exercises, onPress }) => {
    if (exercises.length === 0) return null;

    return (
        <VStack style={styles.container}>
            <Text style={styles.title}>{title}</Text>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.row}
            >
                {exercises.map((exercise) => (
                    <Pressable
                        key={exercise.id}
                        style={styles.card}
                        onPress={() => onPress(exercise.id)}
                        accessibilityRole="button"
                        accessibilityLabel={exerciseDisplayName(exercise)}
                    >
                        <Box style={styles.image}>
                            {exercise.gifFilename ? (
                                <ExpoImage
                                    source={{
                                        uri: buildExerciseGifUrl(
                                            exercise.gifFilename,
                                            EXERCISE_GIF_THUMBNAIL_RESOLUTION,
                                        ),
                                    }}
                                    style={{ width: '100%', height: '100%' }}
                                    contentFit="cover"
                                    autoplay={false}
                                />
                            ) : null}
                        </Box>
                        <Text style={styles.name} numberOfLines={2}>
                            {exerciseDisplayName(exercise)}
                        </Text>
                    </Pressable>
                ))}
            </ScrollView>
        </VStack>
    );
};
