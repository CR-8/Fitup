import { FC, useEffect, useRef } from 'react';
import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { useTranslation } from 'react-i18next';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Text } from '@/components/primitives/text';
import { VStack } from '@/components/primitives/vstack';
import { MISSED_OPTIONS, useMissedSession } from '@/hooks/use-missed-session';

import { MenuItem } from '../actions/components/menu-item';
import { Backdrop } from '../backdrop';
import { Handle } from '../handle';

const styles = StyleSheet.create((theme, rt) => ({
    container: {
        backgroundColor: theme.colors.background,
    },
    backgroundStyle: {
        backgroundColor:
            rt.themeName === 'dark' ? theme.colors.neutral[925] : theme.colors.background,
        borderTopRightRadius: theme.radius['4xl'],
        borderTopLeftRadius: theme.radius['4xl'],
    },
    content: {
        paddingTop: theme.space(5) + theme.sheetHeaderHeight(),
        paddingBottom: rt.insets.bottom + theme.space(5),
    },
    subtitle: {
        ...theme.fontSize.sm,
        color: theme.colors.typography,
        opacity: 0.55,
        paddingHorizontal: theme.space(5),
        paddingBottom: theme.space(3),
    },
}));

const MissedSessionSheet: FC = () => {
    const ref = useRef<BottomSheetModal>(null);
    const { rt } = useUnistyles();
    const { t } = useTranslation(['screens']);
    const { workoutId, workout, choose, close } = useMissedSession();

    useEffect(() => {
        if (workoutId) ref.current?.present();
        else ref.current?.close();
    }, [workoutId]);

    return (
        <BottomSheetModal
            ref={ref}
            backdropComponent={(props) => <Backdrop {...props} pressBehavior="close" />}
            handleComponent={(props) => (
                <Handle
                    handleClose={close}
                    title={t('missed-session.title')}
                    containerStyle={styles.container}
                    {...props}
                />
            )}
            onChange={(index) => {
                if (index === -1 && workoutId) close();
            }}
            topInset={rt.insets.top + 20}
            backgroundStyle={styles.backgroundStyle}
        >
            <BottomSheetView style={styles.content}>
                <Text style={styles.subtitle}>
                    {t('missed-session.subtitle', { name: workout?.name ?? '' })}
                </Text>
                <VStack>
                    {MISSED_OPTIONS.map((option, index) => (
                        <MenuItem
                            key={option}
                            title={t(`missed-session.${option}`)}
                            description={t(`missed-session.${option}Hint`)}
                            last={index === MISSED_OPTIONS.length - 1}
                            onPress={() => void choose(option)}
                        />
                    ))}
                </VStack>
            </BottomSheetView>
        </BottomSheetModal>
    );
};

export default MissedSessionSheet;
