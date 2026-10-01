import { useMemo, useState } from 'react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { FieldPath, FieldValues, useController } from 'react-hook-form';
import { compact } from 'lodash';
import { useTranslation } from 'react-i18next';
import {
    BottomSheet,
    Button as UIButton,
    Checkbox,
    Column,
    FieldGroup,
    Picker,
    Row,
    Spacer,
    Text as UIText,
} from '@expo/ui';

import { HStack } from '@/components/primitives/hstack';
import { BoxProps } from '@/components/primitives/box';
import { Pressable } from '@/components/primitives/pressable';
import { Text } from '@/components/primitives/text';
import { VStack } from '@/components/primitives/vstack';
import { Icon } from '@/components/primitives/icon';
import { Host } from '@/components/native/host';
import { brandTint } from '@/components/native/modifiers';
import { useStoreReviewGateBlocker } from '@/hooks/use-store-review-gate';

import { ChoiceType, ChoicesFieldType, ValueType } from '../../choices';
import { Error } from '../../components';

interface SheetChoicesFieldType<
    T extends FieldValues = FieldValues,
    TName extends FieldPath<T> = FieldPath<T>,
> extends ChoicesFieldType<T, TName> {
    title: string;
    description?: string;
    showActions?: boolean;
    containerStyle?: BoxProps['style'];
}

const flattenChoiceTree = (choices: ChoiceType[]): ChoiceType[] =>
    choices.flatMap((choice) => [
        choice,
        ...(choice.children ? flattenChoiceTree(choice.children) : []),
    ]);

/** Picker items carry strings or numbers; the empty string stands for "none". */
const NONE = '';

const styles = StyleSheet.create((theme) => ({
    container: {
        paddingVertical: theme.space(3),
        paddingHorizontal: theme.space(4),
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: theme.space(3),
    },
    title: (error: boolean) => ({
        flexShrink: 1,
        color: error ? theme.colors.destructive : theme.colors.typography,
    }),
    selectContainer: {
        alignItems: 'center',
        gap: theme.space(1),
        flexShrink: 1,
        maxWidth: '60%',
    },
    selectTitle: {
        flexShrink: 1,
        textAlign: 'right',
        color: theme.colors.mutedTypography,
    },
    errorContainer: {
        paddingHorizontal: theme.space(4),
        marginTop: -theme.space(2),
        marginBottom: theme.space(3),
    },
}));

/**
 * A settings row that picks from a list.
 *
 * One choice: the platform's inline picker menu, no sheet. Several: a native
 * sheet of checkbox rows, grouped by section, with Reset and Done.
 */
function SheetChoices<T extends FieldValues, TName extends FieldPath<T>>({
    title,
    name,
    control,
    value: defaultValue,
    containerStyle,
    choices,
    groups,
    type = 'radio',
    error,
}: SheetChoicesFieldType<T, TName>) {
    const [visible, setVisible] = useState(false);
    const { theme } = useUnistyles();
    const { t } = useTranslation(['common']);
    useStoreReviewGateBlocker(`sheet-choices:${name}`, visible);

    const {
        field: { onChange, value: fieldValue },
    } = useController({ name, control, defaultValue });

    const value = fieldValue as ValueType;

    const sections = useMemo(
        () =>
            groups
                ? groups.map((group) => ({
                      title: group.title,
                      choices: flattenChoiceTree(group.choices),
                  }))
                : [{ title: undefined, choices: flattenChoiceTree(choices || []) }],
        [choices, groups],
    );
    const allChoices = useMemo(() => sections.flatMap((section) => section.choices), [sections]);

    const selectedValues = useMemo(
        () => (Array.isArray(value) ? value : value == null ? [] : [value]),
        [value],
    );

    const selectedTitle = useMemo(() => {
        const selected = compact(
            selectedValues.map((v) => allChoices.find((choice) => choice.value === v)),
        );
        if (selected.length === 0) return null;
        if (selected.length === 1) return selected[0].title;
        return `${selected[0].title}, +${selected.length - 1}`;
    }, [allChoices, selectedValues]);

    const errorMessage = error?.message ? (
        <Error containerStyle={styles.errorContainer}>{t(error.message, { ns: 'common' })}</Error>
    ) : null;

    if (type === 'radio') {
        const current = typeof value === 'string' || typeof value === 'number' ? value : NONE;

        return (
            <VStack>
                <HStack style={[styles.container, containerStyle]}>
                    <Text style={styles.title(!!error)}>{title}</Text>
                    <Host matchContents>
                        <Picker
                            selectedValue={current}
                            onValueChange={(next) => onChange(next === NONE ? null : next)}
                        >
                            {current === NONE ? (
                                <Picker.Item value={NONE} label={t('select', { ns: 'common' })} />
                            ) : null}
                            {allChoices.map((choice) => (
                                <Picker.Item
                                    key={String(choice.value)}
                                    value={choice.value as string | number}
                                    label={choice.title}
                                />
                            ))}
                        </Picker>
                    </Host>
                </HStack>
                {errorMessage}
            </VStack>
        );
    }

    const toggle = (choiceValue: ChoiceType['value'], on: boolean) => {
        const rest = selectedValues.filter((v) => v !== choiceValue);
        const next = on ? [...rest, choiceValue] : rest;
        onChange(next.length > 0 ? next : null);
    };

    return (
        <>
            <VStack>
                <Pressable onPress={() => setVisible(true)}>
                    <HStack style={[styles.container, containerStyle]}>
                        <Text style={styles.title(!!error)}>{title}</Text>
                        <HStack style={styles.selectContainer}>
                            <Text style={styles.selectTitle} numberOfLines={1}>
                                {selectedTitle ?? t('select', { ns: 'common' })}
                            </Text>
                            <Icon
                                name="chevron-right"
                                size={theme.space(3.5)}
                                color={theme.colors.mutedTypography}
                            />
                        </HStack>
                    </HStack>
                </Pressable>
                {errorMessage}
            </VStack>
            <BottomSheet
                isPresented={visible}
                onDismiss={() => setVisible(false)}
                snapPoints={['half', 'full']}
                modifiers={brandTint}
            >
                <Column spacing={8}>
                    <Row alignment="center">
                        <UIButton
                            variant="text"
                            label={t('reset', { ns: 'common' })}
                            onPress={() => onChange(null)}
                        />
                        <Spacer />
                        <UIText textStyle={{ fontSize: 17, fontWeight: '600' }}>{title}</UIText>
                        <Spacer />
                        <UIButton
                            variant="text"
                            label={t('done', { ns: 'common' })}
                            onPress={() => setVisible(false)}
                        />
                    </Row>
                    <FieldGroup>
                        {sections.map((section, index) => (
                            <FieldGroup.Section key={section.title ?? index} title={section.title}>
                                {section.choices.map((choice) => (
                                    <Checkbox
                                        key={String(choice.value)}
                                        label={choice.title}
                                        value={selectedValues.includes(choice.value as never)}
                                        onValueChange={(on) => toggle(choice.value, on)}
                                    />
                                ))}
                            </FieldGroup.Section>
                        ))}
                    </FieldGroup>
                </Column>
            </BottomSheet>
        </>
    );
}

export { SheetChoices };
