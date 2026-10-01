import { useUnistyles } from 'react-native-unistyles';

/**
 * Native-stack options every navigator starts from: an opaque bar in the page
 * colour (the iOS Settings look at rest), the platform back button, and the
 * brand tint on header controls.
 *
 * Theme colours are PlatformColors on iOS; react-native-screens resolves those,
 * the `string` casts only satisfy React Navigation's types.
 */
const useScreen = () => {
    const { theme } = useUnistyles();
    const background = theme.colors.background as string;

    const options = {
        headerBackButtonDisplayMode: 'minimal' as const,
        headerShadowVisible: false,
        headerLargeTitleShadowVisible: false,
        headerStyle: { backgroundColor: background },
        headerLargeStyle: { backgroundColor: background },
        headerTintColor: theme.colors.primary as string,
        headerTitleStyle: { color: theme.colors.typography as string },
        headerLargeTitleStyle: { color: theme.colors.typography as string },
        contentStyle: { backgroundColor: background },
    };

    return { options };
};

export { useScreen };
