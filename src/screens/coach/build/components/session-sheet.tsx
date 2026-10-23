import { FC, useState } from 'react';
import { Modal, Platform, ScrollView } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';

import { Box } from '@/components/primitives/box';
import { HStack } from '@/components/primitives/hstack';
import { Text } from '@/components/primitives/text';
import { Pressable } from '@/components/primitives/pressable';
import { HeaderTextButton } from '@/components/buttons/header';
import { ACCENT } from '@/screens/home/summary';

import { ACTIVITIES, SESSION_MINUTES, type Activity, type Session } from '../plan';
import { ActivityIcon } from './activity-icon';
import { MenuPicker } from '@/components/forms/menu-picker';

/**
 * One session of a day, added or changed: which activity, and for how long.
 * A page sheet over the review on iOS; on Android it covers the screen. Keyed
 * by the session it opens, so each opening starts from that session.
 */

const styles = StyleSheet.create((theme, rt) => ({
    sheet: {
        flex: 1,
        backgroundColor: theme.colors.foreground,
        paddingTop: Platform.OS === 'android' ? rt.insets.top + theme.space(2) : theme.space(2),
        paddingHorizontal: theme.space(4),
    },
    bar: {
        height: 48,
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    title: {
        ...theme.fontSize.default,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: theme.colors.typography,
    },
    content: {
        gap: theme.space(3),
        paddingTop: theme.space(3),
        paddingBottom: theme.space(10),
    },
    heading: {
        fontSize: 22,
        lineHeight: 28,
        fontWeight: theme.fontWeight.bold.fontWeight,
        color: theme.colors.typography,
    },
    activityRow: {
        alignItems: 'center',
        gap: theme.space(3),
        padding: theme.space(2),
        paddingRight: theme.space(4),
        borderRadius: theme.radius.xl,
        backgroundColor: theme.colors.elevated,
    },
    iconCircle: {
        height: 40,
        width: 40,
        borderRadius: theme.radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.neutral[700],
    },
    times: {
        flexWrap: 'wrap',
        gap: theme.space(2.5),
    },
    time: (selected: boolean) => ({
        height: 64,
        width: 64,
        borderRadius: theme.radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.neutral[700],
        borderWidth: 2,
        borderColor: selected ? ACCENT.distance : 'transparent',
    }),
    timeValue: {
        fontSize: 18,
        lineHeight: 20,
        fontWeight: theme.fontWeight.bold.fontWeight,
        color: theme.colors.typography,
    },
    timeUnit: {
        fontSize: 9,
        lineHeight: 11,
        fontWeight: theme.fontWeight.bold.fontWeight,
        color: theme.colors.mutedTypography,
    },
    remove: {
        marginTop: theme.space(6),
        alignSelf: 'center',
    },
    removeText: {
        ...theme.fontSize.default,
        color: theme.colors.destructive,
    },
}));

interface SessionSheetProps {
    /** The day's name, shown as the sheet's title; null when closed. */
    day: string | null;
    /** The session being changed; absent when adding one. */
    initial?: Session;
    onCancel: () => void;
    onSave: (session: Session) => void;
    onRemove?: () => void;
}

export const SessionSheet: FC<SessionSheetProps> = ({
    day,
    initial,
    onCancel,
    onSave,
    onRemove,
}) => {
    const { t } = useTranslation(['screens', 'common']);
    const [activity, setActivity] = useState<Activity>(initial?.activity ?? 'fullBody');
    const [minutes, setMinutes] = useState<number>(initial?.minutes ?? 30);

    return (
        <Modal
            visible={day !== null}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onCancel}
        >
            <Box style={styles.sheet}>
                <HStack style={styles.bar}>
                    <HeaderTextButton title={t('cancel', { ns: 'common' })} onPress={onCancel} />
                    <Text style={styles.title}>{day}</Text>
                    <HeaderTextButton
                        title={t(initial ? 'coach.build.done' : 'coach.build.add', {
                            ns: 'screens',
                        })}
                        onPress={() => onSave({ activity, minutes })}
                        prominent
                    />
                </HStack>

                <ScrollView contentContainerStyle={styles.content}>
                    <Text style={styles.heading}>
                        {t('coach.build.activity', { ns: 'screens' })}
                    </Text>
                    <HStack style={styles.activityRow}>
                        <Box style={styles.iconCircle}>
                            <ActivityIcon activity={activity} size={22} color={ACCENT.distance} />
                        </Box>
                        <MenuPicker
                            value={activity}
                            options={ACTIVITIES.map((value) => ({
                                value,
                                label: t(`coach.build.types.${value}`, { ns: 'screens' }),
                            }))}
                            onChange={setActivity}
                            accessibilityLabel={t('coach.build.activity', { ns: 'screens' })}
                            color="#f5f6f7"
                        />
                    </HStack>

                    <Text style={styles.heading}>{t('coach.build.time', { ns: 'screens' })}</Text>
                    <HStack style={styles.times}>
                        {SESSION_MINUTES.map((value) => (
                            <Pressable
                                key={value}
                                style={styles.time(value === minutes)}
                                onPress={() => setMinutes(value)}
                                accessibilityRole="button"
                                accessibilityState={{ selected: value === minutes }}
                                accessibilityLabel={t('coach.build.minutesValue', {
                                    ns: 'screens',
                                    count: value,
                                })}
                            >
                                <Text style={styles.timeValue}>{value}</Text>
                                <Text style={styles.timeUnit}>
                                    {t('coach.build.minUnit', { ns: 'screens' })}
                                </Text>
                            </Pressable>
                        ))}
                    </HStack>

                    {onRemove ? (
                        <Pressable
                            style={styles.remove}
                            onPress={onRemove}
                            accessibilityRole="button"
                        >
                            <Text style={styles.removeText}>
                                {t('coach.build.remove', { ns: 'screens' })}
                            </Text>
                        </Pressable>
                    ) : null}
                </ScrollView>
            </Box>
        </Modal>
    );
};
