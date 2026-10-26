import { FC, PropsWithChildren } from 'react';
import { StyleSheet } from 'react-native-unistyles';

import { VStack } from '@/components/primitives/vstack';

import { SynHeader } from '../header';

export type SynFrameProps = PropsWithChildren<{
    canClear: boolean;
    onClear: () => void;
}>;

// No tab header (see `useSynTab`): the screen clears the status bar itself.
const styles = StyleSheet.create((theme, rt) => ({
    container: {
        flex: 1,
        paddingTop: rt.insets.top + theme.space(3),
        paddingHorizontal: theme.space(4),
        backgroundColor: theme.colors.background,
    },
}));

/** The conversation under Syn's header, which holds starting a new one. */
export const SynFrame: FC<SynFrameProps> = ({ canClear, onClear, children }) => (
    <VStack style={styles.container}>
        <SynHeader onClear={canClear ? onClear : undefined} />
        {children}
    </VStack>
);

/** Where Syn is unavailable, or still loading: the content under its header. */
export const UnavailableFrame: FC<PropsWithChildren> = ({ children }) => (
    <VStack style={styles.container}>
        <SynHeader />
        {children}
    </VStack>
);
