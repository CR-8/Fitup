import { controlSize, frame, tint } from '@expo/ui/swift-ui/modifiers';

import { colors } from '../../../unistyles';

/** A prominent, full-width button: large control size, label stretched. */
export const fullWidthButton = [controlSize('large')];
export const fullWidthLabel = [frame({ maxWidth: Infinity })];

/** Sheets present in their own SwiftUI host, so they need the tint again. */
export const brandTint = [tint(colors.brand[500])];

/** The filled button's ground is brand 600: white on 500 is only 3.9:1, on 600 it is 4.8:1. */
export const primaryButtonTint = [tint(colors.brand[600])];
