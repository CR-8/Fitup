import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import {
    BottomSheet,
    Button as UIButton,
    Column,
    List,
    ListItem,
    Switch,
    Text as UIText,
} from '@expo/ui';

import {
    brandTint,
    fullWidthButton,
    fullWidthLabel,
    primaryButtonTint,
} from '@/components/native/modifiers';
import { useMergePreview } from '@/hooks/use-merge-preview';

/**
 * "Preview changes": every row the plan would change, with a toggle each, then
 * the one filled button. Nothing is applied until it is pressed.
 */
const MergePreviewSheet: FC = () => {
    const { t, i18n } = useTranslation('screens');
    const preview = useMergePreview();
    const { plan, rows } = preview;

    const day = (date: string) => dayjs(date).locale(i18n.language).format('ddd D MMM');
    const addLabel =
        preview.selectedCount > 0
            ? t('syn.preview.add', { count: preview.selectedCount })
            : t('syn.preview.addMeals');

    return (
        <BottomSheet
            isPresented={!!plan}
            onDismiss={preview.close}
            snapPoints={['half', 'full']}
            modifiers={brandTint}
        >
            <Column spacing={12}>
                <Column spacing={2}>
                    <UIText textStyle={{ fontSize: 20, fontWeight: '600' }}>
                        {t('syn.preview.title')}
                    </UIText>
                    <UIText>{plan?.payload.title ?? ''}</UIText>
                </Column>

                {rows.length > 0 ? (
                    <List>
                        {rows.map((row) => (
                            <ListItem
                                key={row.key}
                                supportingText={
                                    row.kind === 'replaces'
                                        ? t('syn.preview.replacesOf', { name: row.existing?.name })
                                        : row.kind === 'removed'
                                          ? t('syn.preview.removedHint')
                                          : t(`syn.preview.${row.kind}`)
                                }
                                trailing={
                                    <Switch
                                        value={!preview.off.has(row.key)}
                                        onValueChange={(value) => preview.toggle(row.key, value)}
                                    />
                                }
                            >
                                {`${day(row.date)} · ${(row.incoming ?? row.existing)?.name ?? ''}`}
                            </ListItem>
                        ))}
                    </List>
                ) : (
                    <UIText>{t('syn.preview.nothing')}</UIText>
                )}

                <UIText>
                    {preview.mealCount > 0
                        ? t('syn.preview.meals', { count: preview.mealCount })
                        : t('syn.preview.mealsSame')}
                </UIText>

                <UIButton
                    variant="filled"
                    disabled={!preview.canApply}
                    onPress={() => void preview.confirm()}
                    modifiers={[...fullWidthButton, ...primaryButtonTint]}
                >
                    <UIText modifiers={fullWidthLabel}>{addLabel}</UIText>
                </UIButton>
                <UIButton
                    variant="outlined"
                    onPress={preview.askForChanges}
                    modifiers={fullWidthButton}
                >
                    <UIText modifiers={fullWidthLabel}>{t('syn.preview.ask')}</UIText>
                </UIButton>
            </Column>
        </BottomSheet>
    );
};

export default MergePreviewSheet;
