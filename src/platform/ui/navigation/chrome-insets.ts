import {useSafeAreaInsets} from 'react-native-safe-area-context'

/**
 * Shared shell chrome geometry — progressive blur headers + floating tab bar.
 * Keep SecondaryScreenHeader and ProgressiveBlurHeaderBackground in sync here.
 */
export const CHROME_HEADER_ROW = 54
/** Dissolve painted below the nav row; content must clear this. */
export const CHROME_FADE_EXTENSION = 48
export const CHROME_BLUR_INTENSITY = 58
/** Soft dissolve above the floating tab bar — keep short so lists stay readable. */
export const CHROME_BOTTOM_FADE = 40
export const CHROME_BOTTOM_BLUR_INTENSITY = 30

/**
 * Layout spacer under SecondaryScreenHeader (safe area + row + fade).
 * Blur overlay may still paint into the fade zone; content starts below it.
 */
export function useSecondaryChromeSpacerHeight(): number {
  const insets = useSafeAreaInsets()
  return insets.top + CHROME_HEADER_ROW + CHROME_FADE_EXTENSION
}

/**
 * Extra top padding for transparent native-stack screens that already use
 * `contentInsetAdjustmentBehavior="automatic"` — only the fade extension,
 * not the full header (the system already insets for the nav row).
 */
export function useNativeHeaderFadePadding(): number {
  return CHROME_FADE_EXTENSION
}
