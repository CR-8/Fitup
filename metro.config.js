const { getSentryExpoConfig } = require('@sentry/react-native/metro');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getSentryExpoConfig(__dirname);

config.resolver.sourceExts.push('sql');

// Keep the Cloudflare Workers out of the app bundle.
//
// Nothing in `src/` imports them, so Metro would not follow them into the graph
// anyway — but it does crawl and watch the tree, and once `workers/cms` has its
// own `node_modules` the resolver can find a second copy of a shared package
// there. Blocking the directory outright is cheaper than diagnosing that later.
// The root tsconfig excludes `workers` for the same reason, and `.easignore`
// keeps them out of the build upload.
//
// Appended rather than assigned: the default already blocks `.expo/types` and
// the native build directories, and replacing it would quietly un-block those.
config.resolver.blockList = [...config.resolver.blockList, /[\\/]workers[\\/].*/];

module.exports = config;
