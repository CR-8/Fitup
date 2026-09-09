const { getSentryExpoConfig } = require('@sentry/react-native/metro');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getSentryExpoConfig(__dirname);

config.resolver.sourceExts.push('sql');

// Keep the server-side code out of the app bundle.
//
// Nothing in `src/` imports it, so Metro would not follow it into the graph
// anyway — but it does crawl and watch the tree, and once one of these
// directories has its own `node_modules` the resolver can find a second copy of
// a shared package there. Blocking them outright is cheaper than diagnosing
// that later. The root tsconfig excludes both for the same reason, and
// `.easignore` keeps them out of the build upload.
//
// `supabase/functions` is the CMS, which runs on Deno. `workers` is the retired
// Cloudflare pair, kept until the cutover is done.
//
// Appended rather than assigned: the default already blocks `.expo/types` and
// the native build directories, and replacing it would quietly un-block those.
config.resolver.blockList = [
    ...config.resolver.blockList,
    /[\\/]workers[\\/].*/,
    /[\\/]supabase[\\/]functions[\\/].*/,
];

module.exports = config;
