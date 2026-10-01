import { controlSize, frame, tint } from '@expo/ui/swift-ui/modifiers';

import { colors } from '../../../unistyles';

/** A prominent, full-width button: large control size, label stretched. */
export const fullWidthButton = [controlSize('large')];
export const fullWidthLabel = [frame({ maxWidth: Infinity })];

/** Sheets present in their own SwiftUI host, so they need the tint again. */
export const brandTint = [tint(colors.brand[500])];
