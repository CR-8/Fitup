import { FC } from 'react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';

import { HStack } from '@/components/primitives/hstack';
import { VStack } from '@/components/primitives/vstack';
import { Text } from '@/components/primitives/text';
import Spinner from '@/components/feedback/spinner';

/**
 * Syn, working, in the place the answer will appear.
 *
 * The composer's send button already spins, but that is a 20px glyph in the
 * corner while the thread — where the user is actually looking — sits
 * motionless. A chat reply comes back in a second or two and the distinction
 * hardly matters; a plan is a single large JSON completion over a week or eight
 * of training and routinely takes half a minute, during which the screen gave no
 * sign anything was happening at all.
 *
 * Hence two wordings rather than a generic "loading": the honest difference
 * between the two waits is how long they last, and telling someone a plan is
 * being built is what stops them tapping again and spending another generation.
 *
 * Deliberately borrows the assistant bubble's geometry from `../message` rather
 * than importing it — this is not a message, has no row in the database, and
 * must not be mistaken for one.
 */

const styles = StyleSheet.create((theme) => ({
    row: {
        width: '100%',
        alignItems: 'flex-start',
    },
    bubble: {
        maxWidth: '88%',
        alignItems: 'center',
        gap: theme.space(2.5),
        backgroundColor: theme.colors.background,
        borderRadius: theme.radius['2xl'],
        borderBottomLeftRadius: theme.radius.sm,
        paddingHorizontal: theme.space(4),
        paddingVertical: theme.space(3),
    },
    label: {
        color: theme.colors.mutedTypography,
    },
}));

interface PendingProps {
    /** A plan takes tens of seconds; a chat reply does not. */
    kind: 'plan' | 'reply';
}

export const Pending: FC<PendingProps> = ({ kind }) => {
    const { t } = useTranslation('screens');
    const { theme } = useUnistyles();

    return (
        <VStack style={styles.row}>
            <HStack style={styles.bubble}>
                <Spinner size={theme.space(4)} color={theme.colors.mutedTypography} />
                <Text fontSize="sm" style={styles.label}>
                    {t(kind === 'plan' ? 'syn.pending.plan' : 'syn.pending.reply')}
                </Text>
            </HStack>
        </VStack>
    );
};
