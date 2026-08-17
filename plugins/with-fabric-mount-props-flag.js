const { withMainApplication, CodeGenerator } = require('@expo/config-plugins');

const { mergeContents } = CodeGenerator;

/**
 * Disables the React Native 0.86 flag `overrideBySynchronousMountPropsAtMountingAndroid`.
 *
 * The flag defaults to true. With it on, Fabric merges props that were written
 * synchronously — which is how Unistyles applies styles, straight into the shadow tree —
 * into every committed props update, and asserts when the two disagree about the shape
 * of `transform`. Reanimated commits exactly such an update, so the app died on
 * `SurfaceMountingManager.overridePropsReadableMap` a second or two into every launch.
 * The flag did not exist in 0.84, which is why the same dependency set was fine there.
 *
 * This is a workaround for an upstream interop bug, not a fix:
 *   https://github.com/software-mansion/react-native-reanimated/issues/8077
 *   https://github.com/software-mansion/react-native-reanimated/issues/9695
 * Delete this plugin once Reanimated and React Native agree on who owns a shadow node.
 *
 * It lives here rather than in MainApplication.kt because `android/` is generated and
 * git-ignored: an edit there is erased by the next prebuild and never reaches anyone else.
 */

const IMPORTS = [
    'import com.facebook.react.internal.featureflags.ReactNativeFeatureFlags',
    'import com.facebook.react.internal.featureflags.ReactNativeNewArchitectureFeatureFlagsDefaults',
];

const OVERRIDE = [
    '    ReactNativeFeatureFlags.dangerouslyForceOverride(',
    '      object : ReactNativeNewArchitectureFeatureFlagsDefaults() {',
    '        override fun overrideBySynchronousMountPropsAtMountingAndroid(): Boolean = false',
    '      }',
    '    )',
];

/**
 * Both the placement and the choice of call are load-bearing, and each replaces an
 * attempt that crashed on launch:
 *
 *   - Overriding before `loadReactNative` throws `SoLoader.init() not yet called`.
 *     Reading a feature flag crosses into C++, and that call is what loads the
 *     native libraries.
 *   - Plain `override()` after it throws `Feature flags cannot be overridden more
 *     than once`, because React Native already overrode them itself during load
 *     (DefaultNewArchitectureEntryPoint). `dangerouslyForceOverride` is the only way
 *     in, and it replaces the whole provider — so the base class has to be
 *     ReactNativeNewArchitectureFeatureFlagsDefaults, re-declaring the new
 *     architecture flags React Native just set. Extending the plain Defaults instead
 *     would silently switch Fabric and TurboModules back off.
 */
const withFabricMountPropsFlag = (config) =>
    withMainApplication(config, (cfg) => {
        if (cfg.modResults.language !== 'kt') {
            throw new Error(
                `with-fabric-mount-props-flag: expected a Kotlin MainApplication, got "${cfg.modResults.language}".`,
            );
        }

        const withImports = mergeContents({
            tag: 'fabric-mount-props-flag-imports',
            src: cfg.modResults.contents,
            newSrc: IMPORTS.join('\n'),
            anchor: /^import expo\.modules\.ApplicationLifecycleDispatcher/m,
            offset: 0,
            comment: '//',
        });

        const withOverride = mergeContents({
            tag: 'fabric-mount-props-flag',
            src: withImports.contents,
            newSrc: OVERRIDE.join('\n'),
            anchor: /loadReactNative\(this\)/,
            offset: 1,
            comment: '    //',
        });

        // A missing anchor means the prebuild template moved. Failing here is the point:
        // the alternative is a build that looks fine and crashes on the device.
        if (!withImports.didMerge || !withOverride.didMerge) {
            throw new Error(
                'with-fabric-mount-props-flag: could not find the anchors in MainApplication.kt. ' +
                    'The template has changed — re-check the placement rules in this plugin before removing it.',
            );
        }

        cfg.modResults.contents = withOverride.contents;

        return cfg;
    });

module.exports = withFabricMountPropsFlag;
