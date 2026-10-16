// The EAS project id, which is not a secret — it is embedded in every build and
// appears in the updates URL below. Kept as a literal because the EAS CLI, unlike
// the Expo CLI, does not load `.env.local`, so an env-only value leaves
// `eas build` unable to find the project at all.
const easProjectId = process.env.APP_EAS_PROJECT_ID || '91cedf58-1db7-4972-813a-eca58acc014e';

// A store build must never carry an AI provider key: anything in EXPO_PUBLIC_* is
// readable from the binary. Production talks to the `syn-complete` proxy, which
// holds the key as a server secret and enforces the monthly quota. Failing here,
// at config time, is cheaper than discovering a leaked key after release.
const isProductionBuild =
    process.env.APP_VARIANT === 'production' || process.env.EAS_BUILD_PROFILE === 'production';

if (isProductionBuild) {
    if (process.env.EXPO_PUBLIC_AI_API_KEY) {
        throw new Error(
            'EXPO_PUBLIC_AI_API_KEY is set in a production build. Remove it: production uses ' +
                'EXPO_PUBLIC_AI_TRANSPORT=proxy and the provider key lives in the syn-complete function.',
        );
    }
    if (process.env.EXPO_PUBLIC_AI_TRANSPORT === 'direct') {
        throw new Error('EXPO_PUBLIC_AI_TRANSPORT=direct is not allowed in a production build.');
    }
}

module.exports = {
    name: process.env.APP_NAME || 'FitSyn',
    version: process.env.APP_VERSION || '1.0',
    owner: 'fitup2026',
    slug: 'fitup2026',
    orientation: 'portrait',
    // Both, first one canonical: the app was renamed from `fitup`, and every
    // password-reset and confirmation email already sent points at the old
    // address. Answering only the new one left those links opening a browser
    // page of redirect markup instead of the app. `authRedirectUri` in
    // src/services/account.ts reads this list and takes the first entry, so new
    // links use `fitsyn` while the old ones still land.
    scheme: ['fitsyn', 'fitup'],
    // Dark only, as the redesign is; see unistyles.ts.
    userInterfaceStyle: 'dark',
    newArchEnabled: true,
    experiments: {
        typedRoutes: true,
        reactCompiler: true,
    },
    android: {
        versionCode: Number(process.env.APP_BUILD_NUMBER) || 1,
        package: process.env.APP_BUNDLE_IDENTIFIER || '',
        playStoreUrl: process.env.PLAY_STORE_URL,
        softwareKeyboardLayoutMode: 'pan',
        adaptiveIcon: {
            foregroundImage:
                process.env.APP_VARIANT === 'development'
                    ? './assets/images/adaptive-icon-dev.png'
                    : './assets/images/adaptive-icon.png',
            backgroundColor: '#0c0e11',
        },
        permissions: [
            'android.permission.health.WRITE_EXERCISE',
            'android.permission.health.READ_HEART_RATE',
            'android.permission.health.READ_ACTIVE_CALORIES_BURNED',
            'android.permission.health.READ_BASAL_METABOLIC_RATE',
            'android.permission.health.READ_STEPS',
            'android.permission.health.READ_DISTANCE',
            'android.permission.health.READ_WEIGHT',
            'android.permission.health.READ_BODY_FAT',
            'android.permission.health.READ_LEAN_BODY_MASS',
            'android.permission.health.READ_BONE_MASS',
            'android.permission.health.READ_BODY_WATER_MASS',
        ],
    },
    ios: {
        buildNumber: String(process.env.APP_BUILD_NUMBER) || '1',
        appleTeamId: process.env.APP_APPLE_TEAM_ID || '',
        bundleIdentifier: process.env.APP_BUNDLE_IDENTIFIER || '',
        appStoreUrl: process.env.APP_STORE_URL,
        supportsTablet: false,
        // Sign in with Apple, offered first on iOS beside Google.
        usesAppleSignIn: true,
        config: {
            usesNonExemptEncryption: false,
        },
        // NOTE: fitsyn.app must actually be owned and hosting an
        // apple-app-site-association file before universal links work — this
        // is a rename of the literal, not a guarantee the domain exists yet.
        associatedDomains: ['applinks:fitsyn.app', 'webcredentials:fitsyn.app'],
        infoPlist: {
            CFBundleAllowMixedLocalizations: true,
            UIBackgroundModes: ['audio', 'remote-notification'],
            NSSupportsLiveActivities: true,
            NSSupportsLiveActivitiesFrequentUpdates: true,
        },
        privacyManifests: {
            NSPrivacyTracking: false,
            NSPrivacyCollectedDataTypes: [
                {
                    NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeCoarseLocation',
                    NSPrivacyCollectedDataTypeLinked: true,
                    NSPrivacyCollectedDataTypeTracking: false,
                    NSPrivacyCollectedDataTypePurposes: [
                        'NSPrivacyCollectedDataTypePurposeAnalytics',
                    ],
                },
                {
                    NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeHealth',
                    NSPrivacyCollectedDataTypeLinked: true,
                    NSPrivacyCollectedDataTypeTracking: false,
                    NSPrivacyCollectedDataTypePurposes: [
                        'NSPrivacyCollectedDataTypePurposeAppFunctionality',
                        'NSPrivacyCollectedDataTypePurposeAnalytics',
                    ],
                },
                {
                    NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeFitness',
                    NSPrivacyCollectedDataTypeLinked: true,
                    NSPrivacyCollectedDataTypeTracking: false,
                    NSPrivacyCollectedDataTypePurposes: [
                        'NSPrivacyCollectedDataTypePurposeAppFunctionality',
                        'NSPrivacyCollectedDataTypePurposeAnalytics',
                    ],
                },
                {
                    NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeOtherUserContent',
                    NSPrivacyCollectedDataTypeLinked: true,
                    NSPrivacyCollectedDataTypeTracking: false,
                    NSPrivacyCollectedDataTypePurposes: [
                        'NSPrivacyCollectedDataTypePurposeAppFunctionality',
                    ],
                },
                {
                    NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeUserID',
                    NSPrivacyCollectedDataTypeLinked: true,
                    NSPrivacyCollectedDataTypeTracking: false,
                    NSPrivacyCollectedDataTypePurposes: [
                        'NSPrivacyCollectedDataTypePurposeAppFunctionality',
                        'NSPrivacyCollectedDataTypePurposeAnalytics',
                    ],
                },
                {
                    NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeDeviceID',
                    NSPrivacyCollectedDataTypeLinked: true,
                    NSPrivacyCollectedDataTypeTracking: false,
                    NSPrivacyCollectedDataTypePurposes: [
                        'NSPrivacyCollectedDataTypePurposeAppFunctionality',
                        'NSPrivacyCollectedDataTypePurposeAnalytics',
                    ],
                },
                {
                    NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeProductInteraction',
                    NSPrivacyCollectedDataTypeLinked: true,
                    NSPrivacyCollectedDataTypeTracking: false,
                    NSPrivacyCollectedDataTypePurposes: [
                        'NSPrivacyCollectedDataTypePurposeAnalytics',
                    ],
                },
                {
                    NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeCrashData',
                    NSPrivacyCollectedDataTypeLinked: true,
                    NSPrivacyCollectedDataTypeTracking: false,
                    NSPrivacyCollectedDataTypePurposes: [
                        'NSPrivacyCollectedDataTypePurposeAppFunctionality',
                    ],
                },
                {
                    NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypePerformanceData',
                    NSPrivacyCollectedDataTypeLinked: true,
                    NSPrivacyCollectedDataTypeTracking: false,
                    NSPrivacyCollectedDataTypePurposes: [
                        'NSPrivacyCollectedDataTypePurposeAppFunctionality',
                    ],
                },
                {
                    NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeOtherDiagnosticData',
                    NSPrivacyCollectedDataTypeLinked: true,
                    NSPrivacyCollectedDataTypeTracking: false,
                    NSPrivacyCollectedDataTypePurposes: [
                        'NSPrivacyCollectedDataTypePurposeAppFunctionality',
                    ],
                },
                {
                    NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeOtherDataTypes',
                    NSPrivacyCollectedDataTypeLinked: true,
                    NSPrivacyCollectedDataTypeTracking: false,
                    NSPrivacyCollectedDataTypePurposes: [
                        'NSPrivacyCollectedDataTypePurposeAppFunctionality',
                        'NSPrivacyCollectedDataTypePurposeAnalytics',
                    ],
                },
            ],
        },
    },
    // The launcher label, per language. These override the `name` above on a
    // device set to that language — which is why an app called FitSyn once
    // sat in the drawer as "Fitup" (and, two renames ago, "Скульпт" in
    // Russian). Every entry must be updated with the app name, not just
    // `name`.
    locales: {
        en: './src/locale/translations/meta/en.json',
        hi: './src/locale/translations/meta/hi.json',
    },
    icon:
        process.env.APP_VARIANT === 'development'
            ? './assets/images/icon-dev.png'
            : './assets/images/icon.png',
    plugins: [
        'expo-sqlite',
        'expo-web-browser',
        'expo-audio',
        'expo-asset',
        'expo-mail-composer',
        'expo-apple-authentication',
        [
            'expo-image-picker',
            {
                // Feedback can attach a screenshot the person chooses; nothing is read otherwise.
                photosPermission:
                    'Choose a screenshot to attach to your feedback. FitSyn only reads the image you pick.',
            },
        ],
        'expo-image',
        'expo-sharing',
        'expo-status-bar',
        '@bacons/apple-targets',
        [
            '@kingstinct/react-native-healthkit',
            {
                NSHealthShareUsageDescription: 'FitSyn reads your heart rate during workouts',
                NSHealthUpdateUsageDescription: 'FitSyn saves your completed workouts to Health',
            },
        ],
        'expo-health-connect',
        [
            'react-native-edge-to-edge',
            {
                android: {
                    // Android keeps the pre-native UI, so native dialogs stay off
                    // Material You's wallpaper colours.
                    parentTheme: 'Default',
                    enforceNavigationBarContrast: false,
                },
            },
        ],
        // Android's date fields use the community picker; iOS uses SwiftUI's.
        '@react-native-community/datetimepicker',
        [
            'expo-build-properties',
            {
                android: {
                    compileSdkVersion: 36,
                    targetSdkVersion: 35,
                    minSdkVersion: 26,
                },
            },
        ],
        [
            'expo-router',
            {
                root: './src/routes',
            },
        ],
        [
            'expo-localization',
            {
                // Drives `locales_config.xml`, which is what Android 13+ offers
                // in its per-app language picker. Listing a language the app has
                // no translations for lets the OS switch to it and get English.
                supportedLocales: {
                    ios: ['en', 'hi'],
                    android: ['en', 'hi'],
                },
            },
        ],
        'expo-background-task',
        [
            'expo-notifications',
            {
                enableBackgroundRemoteNotifications: true,
                sounds: ['./assets/sounds/timer_end.wav'],
            },
        ],
        [
            'react-native-permissions',
            {
                iosPermissions: ['Notifications'],
            },
        ],
        [
            // Android's typefaces (the pre-native UI); iOS uses the system font
            // for text. Barlow Condensed SemiBold sets the big numerals on both.
            'expo-font',
            {
                ios: {
                    fonts: ['./assets/fonts/BarlowCondensed-SemiBold.ttf'],
                },
                android: {
                    fonts: [
                        './assets/fonts/DMSans-Regular.ttf',
                        './assets/fonts/DMSans-Medium.ttf',
                        './assets/fonts/DMSans-SemiBold.ttf',
                        './assets/fonts/DMSans-Bold.ttf',
                        './assets/fonts/SpaceGrotesk-Medium.ttf',
                        './assets/fonts/SpaceGrotesk-SemiBold.ttf',
                        './assets/fonts/SpaceGrotesk-Bold.ttf',
                        './assets/fonts/BarlowCondensed-SemiBold.ttf',
                    ],
                },
            },
        ],
        [
            'expo-splash-screen',
            {
                image: './assets/images/splash-icon.png',
                imageWidth: 125,
                resizeMode: 'contain',
                // The system grounds, so launch matches the appearance the app
                // opens in.
                backgroundColor: '#08090b',
                dark: { backgroundColor: '#08090b' },
                // Android opens on the pre-native UI's ground.
                android: {
                    backgroundColor: '#0c0e11',
                    dark: { backgroundColor: '#0c0e11' },
                },
            },
        ],
        [
            '@sentry/react-native/expo',
            {
                project: process.env.APP_SENTRY_PROJECT || '',
                organization: process.env.APP_SENTRY_ORGANIZATION || '',
            },
        ],
        // Works around a Reanimated/Unistyles shadow tree conflict that crashes Android
        // on launch under React Native 0.86. Delete once upstream resolves it; see
        // reanimated issues 8077 and 9695.
        './plugins/with-fabric-mount-props-flag',
    ],
    runtimeVersion: {
        policy: 'appVersion',
    },
    extra: {
        appVariant: process.env.APP_VARIANT || process.env.EAS_BUILD_PROFILE || 'development',
        buildProfile: process.env.EAS_BUILD_PROFILE || process.env.APP_VARIANT || 'development',
        eas: {
            projectId: easProjectId,
        },
    },
    updates: {
        url: `https://u.expo.dev/${easProjectId}`,
        enableBsdiffPatchSupport: false,
    },
};
