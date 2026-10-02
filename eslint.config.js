const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const eslintPluginPrettierRecommended = require('eslint-plugin-prettier/recommended');
const pluginQuery = require('@tanstack/eslint-plugin-query');
const { allExtensions } = require('eslint-config-expo/flat/utils/extensions');

module.exports = defineConfig([
    expoConfig,
    eslintPluginPrettierRecommended,
    ...pluginQuery.configs['flat/recommended'],
    {
        ignores: ['dist/*'],
    },
    {
        // Through the `@/` alias too, `back` must find `back.android.tsx` the way
        // Metro does: Android's presentation lives in platform files.
        settings: {
            'import/resolver': {
                typescript: { extensions: allExtensions },
            },
        },
    },
]);
