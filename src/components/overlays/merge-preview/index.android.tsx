import { FC, useEffect, useRef } from 'react';
import { Switch } from 'react-native';
import { BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useTranslation } from 'react-i18next';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import dayjs from 'dayjs';

import { Button } from '@/components/buttons/base';
import { HStack } from '@/components/primitives/hstack';
import { Text } from '@/components/primitives/text';
import { VStack } from '@/components/primitives/vstack';
import { useMergePreview } from '@/hooks/use-merge-preview';

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
        paddingHorizontal: theme.space(5),
        paddingBottom: rt.insets.bottom + theme.space(5),
        gap: theme.space(3),
    },
    subtitle: {
        ...theme.fontSize.sm,
        color: theme.colors.mutedTypography,
    },
    row: {
        alignItems: 'center',
        gap: theme.space(3),
        paddingVertical: theme.space(2),
    },
    rowText: {
        flex: 1,
        gap: theme.space(0.5),
    },
    rowTitle: {
        ...theme.fontSize.default,
        fontWeight: theme.fontWeight.medium.fontWeight,
        color: theme.colors.typography,
    },
    rowHint: {
        ...theme.fontSize.sm,
        color: theme.colors.mutedTypography,
    },
    actions: {
        gap: theme.space(3),
        paddingTop: theme.space(2),
    },
}));

const MergePreviewSheet: FC = () => {
    const ref = useRef<BottomSheetModal>(null);
    const { t, i18n } = useTranslation('screens');
    const { rt, theme } = useUnistyles();
    const preview = useMergePreview();
    const { plan, rows } = preview;

    useEffect(() => {
        if (plan) ref.current?.present();
        else ref.current?.close();
    }, [plan]);

    const day = (date: string) => dayjs(date).locale(i18n.language).format('ddd D MMM');
    const addLabel =
        preview.selectedCount > 0
            ? t('syn.preview.add', { count: preview.selectedCount })
            : t('syn.preview.addMeals');

    return (
        <BottomSheetModal
            ref={ref}
            snapPoints={['70%']}
            enableDynamicSizing={false}
            backdropComponent={(props) => <Backdrop {...props} pressBehavior="close" />}
            handleComponent={(props) => (
                <Handle
                    handleClose={preview.close}
                    title={t('syn.preview.title')}
                    containerStyle={styles.container}
                    {...props}
                />
            )}
            onChange={(index) => {
                if (index === -1 && plan) preview.close();
            }}
            topInset={rt.insets.top + 20}
            backgroundStyle={styles.backgroundStyle}
        >
            <BottomSheetScrollView contentContainerStyle={styles.content}>
                <Text style={styles.subtitle}>{plan?.payload.title ?? ''}</Text>

                {rows.length > 0 ? (
                    <VStack>
                        {rows.map((row) => (
                            <HStack key={row.key} style={styles.row}>
                                <VStack style={styles.rowText}>
                                    <Text style={styles.rowTitle}>
                                        {`${day(row.date)} · ${(row.incoming ?? row.existing)?.name ?? ''}`}
                                    </Text>
                                    <Text style={styles.rowHint}>
                                        {row.kind === 'replaces'
                                            ? t('syn.preview.replacesOf', {
                                                  name: row.existing?.name,
                                              })
                                            : row.kind === 'removed'
                                              ? t('syn.preview.removedHint')
                                              : t(`syn.preview.${row.kind}`)}
                                    </Text>
                                </VStack>
                                <Switch
                                    value={!preview.off.has(row.key)}
                                    onValueChange={(value) => preview.toggle(row.key, value)}
                                    trackColor={{ true: theme.colors.brand[500] }}
                                    accessibilityLabel={`${day(row.date)} ${(row.incoming ?? row.existing)?.name ?? ''}`}
                                />
                            </HStack>
                        ))}
                    </VStack>
                ) : (
                    <Text style={styles.subtitle}>{t('syn.preview.nothing')}</Text>
                )}

                <Text style={styles.subtitle}>
                    {preview.mealCount > 0
                        ? t('syn.preview.meals', { count: preview.mealCount })
                        : t('syn.preview.mealsSame')}
                </Text>

                <VStack style={styles.actions}>
                    <Button
                        type="primary"
                        title={addLabel}
                        disabled={!preview.canApply}
                        loading={preview.isApplying}
                        onPress={() => void preview.confirm()}
                    />
                    <Button
                        type="outline"
                        title={t('syn.preview.ask')}
                        onPress={preview.askForChanges}
                    />
                </VStack>
            </BottomSheetScrollView>
        </BottomSheetModal>
    );
};

export default MergePreviewSheet;
