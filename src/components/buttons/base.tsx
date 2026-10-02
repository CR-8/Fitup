import { FC } from 'react';
import {
    ActivityIndicator,
    View,
    type AccessibilityState,
    type StyleProp,
    type TextStyle,
    type ViewStyle,
} from 'react-native';
import { Button as UIButton, Icon as UIIcon, Row, Text as UIText } from '@expo/ui';
import { useUnistyles } from 'react-native-unistyles';

import { Host } from '@/components/native/host';
import { fullWidthButton, fullWidthLabel } from '@/components/native/modifiers';
import { icons, type IconName } from '@/theme/icons';

/**
 * The system button: a SwiftUI button. (Android draws the pre-native button in
 * `base.android.tsx`, which takes the same props.)
 *
 * - `primary` is the prominent, tinted action (filled).
 * - `default` is the secondary action (bordered / outlined).
 * - `link` is a plain text button.
 *
 * `primary` and `default` stretch to the width they are given. `containerStyle`
 * is layout around the button (margins, width), never its look.
 */
export type ButtonProps = {
    title?: string;
    /** Shown before the title, the two centred together. */
    icon?: IconName;
    type?: 'default' | 'primary' | 'link';
    size?: 'sm' | 'default' | 'lg';
    disabled?: boolean;
    loading?: boolean;
    containerStyle?: StyleProp<ViewStyle>;
    onPress?: () => void;
    accessibilityLabel?: string;
    accessibilityState?: AccessibilityState;
    /** Android only: there the app draws the label. iOS keeps the system's. */
    textStyle?: StyleProp<TextStyle>;
    /** Android only, as `textStyle`: iOS shows the system spinner in the tint. */
    spinnerColor?: string;
    testID?: string;
};

const VARIANTS = { primary: 'filled', default: 'outlined', link: 'text' } as const;

const Button: FC<ButtonProps> = ({
    title,
    icon,
    type = 'default',
    disabled = false,
    loading = false,
    containerStyle,
    onPress,
    accessibilityLabel,
    accessibilityState,
    testID,
}) => {
    const { theme } = useUnistyles();
    const stretch = type !== 'link';

    if (loading) {
        return (
            <View
                style={[
                    { minHeight: 50, alignItems: 'center', justifyContent: 'center' },
                    containerStyle,
                ]}
            >
                <ActivityIndicator color={theme.colors.primary} />
            </View>
        );
    }

    // The full-width frame goes on the whole label, so an icon sits beside its
    // title and the pair centres together rather than the icon hugging the edge.
    const frame = stretch ? fullWidthLabel : undefined;
    const label = icon ? (
        <Row spacing={6} alignment="center" modifiers={frame}>
            <UIIcon name={icons[icon].ios} size={17} />
            <UIText>{title ?? ''}</UIText>
        </Row>
    ) : (
        <UIText modifiers={frame}>{title ?? ''}</UIText>
    );

    return (
        <View
            style={[stretch && { width: '100%' }, containerStyle]}
            accessibilityLabel={accessibilityLabel}
            accessibilityState={accessibilityState}
        >
            <Host matchContents={stretch ? { vertical: true } : true}>
                <UIButton
                    variant={VARIANTS[type]}
                    onPress={onPress}
                    disabled={disabled}
                    testID={testID}
                    modifiers={stretch ? fullWidthButton : undefined}
                >
                    {label}
                </UIButton>
            </Host>
        </View>
    );
};

export { Button };
