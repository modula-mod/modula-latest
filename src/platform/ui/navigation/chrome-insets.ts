import {useSafeAreaInsets} from 'react-native-safe-area-context'

/**
 * Shared shell chrome geometry — progressive blur headers + floating tab bar.
 * Keep SecondaryScreenHeader and ProgressiveBlurHeaderBackground in sync here.
 */
export const CHROME_HEADER_ROW = 54
/** Dissolve painted below the nav row; content may scroll under this zone. */
export const CHROME_FADE_EXTENSION = 48
export const CHROME_BLUR_INTENSITY = 58
/**
 * Absolute height of the shell bottom progressive blur, measured from the
 * physical screen bottom (`bottom: 0`). Do not add safe-area or tab-bar height
 * — those lift the dissolve up to the tab island.
 */
export const CHROME_BOTTOM_FADE = 28
export const CHROME_BOTTOM_BLUR_INTENSITY = 40

/**
 * Layout spacer under SecondaryScreenHeader — safe area + nav row only.
 * Fade extension is painted by the overlay so list content can scroll under it.
 */
export function useSecondaryChromeSpacerHeight(): number {
  const insets = useSafeAreaInsets()
  return insets.top + CHROME_HEADER_ROW
}

/**
 * Extra top padding for transparent native-stack screens that already use
 * `contentInsetAdjustmentBehavior="automatic"` — only the fade extension,
 * not the full header (the system already insets for the nav row).
 */
export function useNativeHeaderFadePadding(): number {
  return CHROME_FADE_EXTENSION
}
