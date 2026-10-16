import { FC, useState } from 'react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';

import { HStack } from '@/components/primitives/hstack';
import { Text } from '@/components/primitives/text';
import { Input } from '@/components/primitives/input';
import { Pressable } from '@/components/primitives/pressable';
import { Icon } from '@/components/primitives/icon';
import { Card, CardTitle } from '@/components/layout/card';
import { ChoiceChips } from '@/components/forms/choice-chips';
import type { AiProfileSelect } from '@/db/schema';

/**
 * Diet pattern and allergies, as asked by the meal-plan form, Settings and
 * onboarding. Controlled: the screen decides where the answers are kept and
 * when they are saved; only the half-typed "Add another" lives here.
 */

export type Diet = NonNullable<AiProfileSelect['dietaryPattern']>;

export interface DietAnswers {
    dietaryPattern?: Diet | null;
    allergens?: string[];
}

// Indian patterns first: they are the common answers for this plan.
const DIETS: Diet[] = [
    'vegetarian',
    'eggetarian',
    'omnivore',
    'vegan',
    'pescatarian',
    'halal',
    'kosher',
];
const ALLERGENS = [
    'peanuts',
    'tree nuts',
    'dairy',
    'gluten',
    'eggs',
    'soy',
    'fish',
    'shellfish',
    'sesame',
];

const styles = StyleSheet.create((theme) => ({
    hint: {
        ...theme.fontSize.sm,
        color: theme.colors.mutedTypography,
    },
    input: {
        ...theme.fontSize.default,
        flex: 1,
        minHeight: 48,
        paddingHorizontal: theme.space(3),
        borderRadius: theme.radius.xl,
        backgroundColor: theme.colors.input,
        color: theme.colors.typography,
    },
    otherRow: {
        alignItems: 'center',
        gap: theme.space(2),
    },
    addButton: {
        height: 44,
        width: 44,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: theme.radius.full,
        backgroundColor: theme.colors.elevated,
    },
}));

interface DietFieldsProps {
    diet: Diet | null;
    allergens: string[];
    onChange: (updates: DietAnswers) => void;
}

export const DietFields: FC<DietFieldsProps> = ({ diet, allergens, onChange }) => {
    const { t } = useTranslation(['screens']);
    const { theme } = useUnistyles();
    const [other, setOther] = useState('');

    const addOther = () => {
        const value = other.trim().toLowerCase();
        if (value && !allergens.includes(value)) onChange({ allergens: [...allergens, value] });
        setOther('');
    };

    return (
        <>
            <Card>
                <CardTitle title={t('coach.new.diet', { ns: 'screens' })} />
                <ChoiceChips
                    options={DIETS.map((value) => ({
                        value,
                        label: t(`coach.new.diets.${value}`, { ns: 'screens' }),
                    }))}
                    selected={diet ? [diet] : []}
                    onToggle={(value) =>
                        onChange({ dietaryPattern: diet === value ? null : value })
                    }
                />
            </Card>

            <Card>
                <CardTitle title={t('coach.new.allergies', { ns: 'screens' })} />
                <Text style={styles.hint}>{t('coach.new.allergiesHint', { ns: 'screens' })}</Text>
                <ChoiceChips
                    multiple
                    // Anything already on the profile stays visible, even if typed.
                    options={[
                        ...ALLERGENS,
                        ...allergens.filter((value) => !ALLERGENS.includes(value)),
                    ].map((value) => ({
                        value,
                        label: t(`coach.new.allergens.${value.replace(' ', '_')}`, {
                            ns: 'screens',
                            defaultValue: value,
                        }),
                    }))}
                    selected={allergens}
                    onToggle={(value) =>
                        onChange({
                            allergens: allergens.includes(value)
                                ? allergens.filter((entry) => entry !== value)
                                : [...allergens, value],
                        })
                    }
                />
                <HStack style={styles.otherRow}>
                    <Input
                        style={styles.input}
                        value={other}
                        onChangeText={setOther}
                        onSubmitEditing={addOther}
                        placeholder={t('coach.new.otherAllergy', { ns: 'screens' })}
                        maxLength={40}
                        returnKeyType="done"
                        accessibilityLabel={t('coach.new.otherAllergy', { ns: 'screens' })}
                    />
                    <Pressable
                        style={styles.addButton}
                        onPress={addOther}
                        disabled={!other.trim()}
                        accessibilityRole="button"
                        accessibilityLabel={t('coach.new.addAllergy', { ns: 'screens' })}
                    >
                        <Icon name="plus" size={20} color={theme.colors.typography} />
                    </Pressable>
                </HStack>
            </Card>
        </>
    );
};
