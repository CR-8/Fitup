/**
 * Android-only tab bar (`index.android.tsx`). expo-router bundles every route
 * file on every platform, so `(tabs)/_layout.android.tsx` is in the iOS bundle
 * too and its import must resolve there — iOS uses native tabs and never
 * renders this.
 */
export const Menu = () => null;
