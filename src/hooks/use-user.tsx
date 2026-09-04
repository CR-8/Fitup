import { createContext, PropsWithChildren, useContext, useEffect, FC } from 'react';
import * as Application from 'expo-application';
import * as Device from 'expo-device';
import { useMutation, useQuery } from '@tanstack/react-query';
import { UnistylesRuntime } from 'react-native-unistyles';
import { getLocales, getCalendars } from 'expo-localization';

import i18n from '@/locale/i18n';
import { createOrUpdateCurrentUser, getCurrentUser } from '@/crud/user';
import { queryClient } from '@/queries';
import { ensureValidToken } from '@/services/auth';
import { isSyncEnabled } from '@/sync/config';
import { normalizeLanguage, supportedLanguages } from '@/locale/constants';
import type { UserSelect } from '@/db/schema/user';
import { z } from 'zod';
import { storage } from '@/storage';
import { readBiologicalSex, readDateOfBirth } from '@/services/health';

import { useAccount } from './use-account';

export const themes = ['auto', 'light', 'dark'] as const;

export const editUserSchema = z.object({
    theme: z.enum(themes).optional(),
    lng: z.enum(supportedLanguages).optional(),
    pushes: z.boolean().optional(),
    screenAutoLock: z.boolean().optional(),
    bodyWeightUnits: z.enum(['kg', 'lb']).optional(),
    measurementUnits: z.enum(['cm', 'in']).optional(),
    weightUnits: z.enum(['kg', 'lb']).optional(),
    distanceUnits: z.enum(['km', 'mi']).optional(),
    firstWeekday: z.number().optional(),
    timeFormat: z.enum(['12h', '24h']).optional(),
    playSounds: z.boolean().optional(),
    soundsVolume: z.number().optional(),
    mhrFormula: z.enum(['nes', 'fox', 'tanaka', 'inbar', 'gulati', 'gellish', 'manual']).optional(),
    mhrManualValue: z.number().int().min(100).max(240).nullable().optional(),
    birthday: z.date().nullable().optional(),
    biologicalSex: z.enum(['female', 'male', 'other']).nullable().optional(),
    activityLevel: z.enum(['sedentary', 'active', 'trained']).nullable().optional(),
});

export type EditUserFormData = z.infer<typeof editUserSchema>;

const applyTheme = (theme: (typeof themes)[number]) => {
    if (theme === 'auto') {
        UnistylesRuntime.setTheme(UnistylesRuntime.colorScheme === 'dark' ? 'dark' : 'light');
        storage.set('user.theme', 'auto');
    } else {
        UnistylesRuntime.setTheme(theme);
        storage.set('user.theme', theme);
    }
};

type UserContextType = ReturnType<typeof useUserProvider>;

const userContext = createContext<UserContextType>({} as UserContextType);

const UserProvider: FC<PropsWithChildren> = ({ children }) => {
    const user = useUserProvider();

    return <userContext.Provider value={user}>{children}</userContext.Provider>;
};

const useUser = () => {
    return useContext(userContext);
};

const useUserProvider = () => {
    // False until the local row this session owns has been decided. Creating a
    // user before that is what produced a second, unlinked one on upgrade: the
    // row this device already had was linked to an account nobody had looked for
    // yet, so `getCurrentUser` found nothing and this made another.
    const { isPrepared } = useAccount();

    const { data: user } = useQuery({
        queryKey: ['user'],
        queryFn: async () => {
            return await getCurrentUser();
        },
    });

    // Bootstrap auth token once when the user ID is known.
    // Runs in the background — if the server is unreachable the next sync cycle will retry.
    useEffect(() => {
        if (!user?.id || !isSyncEnabled()) return;
        ensureValidToken(user.id).catch(() => {});
    }, [user?.id]);

    const { mutate, mutateAsync, isPending } = useMutation({
        mutationFn: createOrUpdateCurrentUser,
        onMutate: async (newUser) => {
            await queryClient.cancelQueries({ queryKey: ['user'] });

            const previousUser = queryClient.getQueryData<UserSelect>(['user']);
            const previousLng = i18n.language;
            const previousTheme = previousUser?.theme || 'dark';

            // Optimistically update cache, i18n language and theme
            queryClient.setQueryData(['user'], { ...previousUser, ...newUser });
            if (newUser.lng && newUser.lng !== previousLng) {
                i18n.changeLanguage(newUser.lng);
            }
            if (newUser.theme && newUser.theme !== previousTheme) {
                applyTheme(newUser.theme as (typeof themes)[number]);
            }

            return { previousUser, previousLng, previousTheme };
        },
        onError: (_, __, context) => {
            queryClient.setQueryData(['user'], context?.previousUser);

            if (context?.previousLng && context.previousLng !== i18n.language) {
                i18n.changeLanguage(context.previousLng);
            }

            if (context?.previousTheme !== context?.previousUser?.theme) {
                applyTheme(context?.previousTheme || 'dark');
            }
        },
        onSettled: () => queryClient.invalidateQueries({ queryKey: ['user'] }),
    });

    useEffect(() => {
        const initUser = async () => {
            const existingUser = await getCurrentUser();

            const locales = getLocales();
            const calendars = getCalendars();

            // Normalised, not taken as read. A device that has been here a
            // while may still hold Spanish, Russian or Chinese — and `lng` is
            // enum-validated on write, so leaving one in place would fail the
            // save of any other setting on a field nobody touched.
            const userLng = normalizeLanguage(existingUser?.lng || i18n.language);
            const userTheme = existingUser?.theme || 'dark';
            const userBodyWeightUnits =
                existingUser?.bodyWeightUnits ??
                (locales[0].measurementSystem === 'metric' ? 'kg' : 'lb');
            const userMeasurementUnits =
                existingUser?.measurementUnits ??
                (locales[0].measurementSystem === 'metric' ? 'cm' : 'in');
            const userWeightUnits =
                existingUser?.weightUnits ??
                (locales[0].measurementSystem === 'metric' ? 'kg' : 'lb');
            const userDistanceUnits =
                existingUser?.distanceUnits ??
                (locales[0].measurementSystem === 'metric' ? 'km' : 'mi');
            const userTemperatureUnits =
                existingUser?.temperatureUnits ??
                (locales[0].measurementSystem === 'metric' ? 'celsius' : 'fahrenheit');
            const userFirstWeekday = existingUser?.firstWeekday || calendars[0].firstWeekday;
            const userTimeFormat =
                existingUser?.timeFormat ?? (calendars[0].uses24hourClock ? '24h' : '12h');
            const userBirthday = existingUser?.birthday ?? (await readDateOfBirth());
            const userBiologicalSex = existingUser?.biologicalSex ?? (await readBiologicalSex());

            mutate({
                applicationId: Application.applicationId,
                applicationName: Application.applicationName,
                applicationVersion: Application.nativeApplicationVersion,
                applicationBuildNumber: Application.nativeBuildVersion,
                device: Device.modelId,
                deviceBrand: Device.brand,
                deviceType: Device.deviceType ? Device.DeviceType[Device.deviceType] : 'UNKNOWN',
                deviceModel: Device.modelName,
                deviceSystemName: Device.osName,
                deviceSystemVersion: Device.osVersion,
                lng: userLng,
                theme: userTheme,
                bodyWeightUnits: userBodyWeightUnits,
                measurementUnits: userMeasurementUnits,
                weightUnits: userWeightUnits,
                distanceUnits: userDistanceUnits,
                temperatureUnits: userTemperatureUnits,
                firstWeekday: userFirstWeekday,
                timeFormat: userTimeFormat,
                timeZone: calendars[0].timeZone,
                calendar: calendars[0].calendar,
                textDirection: locales[0].textDirection,
                currencyCode: locales[0].currencyCode,
                currencySymbol: locales[0].currencySymbol,
                regionCode: locales[0].regionCode,
                birthday: userBirthday,
                biologicalSex: userBiologicalSex,
            });
        };

        if (isPrepared) initUser();
        // Re-runs when the active row changes, which happens when an account is
        // resolved on sign-in. A row restored from a backup carries the profile
        // but none of this device's own settings — units, locale, build number —
        // because those describe the phone rather than the person.
    }, [isPrepared, mutate, user?.id]);

    return {
        user,
        updateUser: mutateAsync,
        isUpdating: isPending,
    };
};

export { UserProvider, useUser };
