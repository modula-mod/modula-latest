import {Platform} from 'react-native'

/**
 * Bottom padding for sheets that share the screen with the soft keyboard.
 * Prefer native sheet keyboard behaviour when Phase 4.5 BottomSheet lands;
 * this helper keeps RN Modal sheets from sitting under the keyboard.
 */
export function sheetKeyboardBottomInset(
  keyboardHeight: number,
  safeBottom: number,
  minimum = 16,
): number {
  if (keyboardHeight <= 0) {
    return Math.max(safeBottom, minimum)
  }

  // iOS sheets typically need the full keyboard height; Android already
  // resizes the window in many configurations, so keep a lighter pad.
  if (Platform.OS === 'android') {
    return Math.max(safeBottom, minimum)
  }

  return Math.max(keyboardHeight, safeBottom, minimum)
}

/** ScrollView props that keep focused fields visible without double-offset. */
export const keyboardScrollProps = {
  keyboardShouldPersistTaps: 'handled' as const,
  keyboardDismissMode: Platform.OS === 'ios' ? ('interactive' as const) : ('on-drag' as const),
  contentInsetAdjustmentBehavior: 'automatic' as const,
  automaticallyAdjustKeyboardInsets: Platform.OS === 'ios',
}
