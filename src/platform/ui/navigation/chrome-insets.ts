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
 * Short feather above the home-indicator / under the floating tab island.
 * Keep this small — the liquid-glass tab bar is the chrome; a tall muddy
 * progressive band just obscures feed text.
 */
export const CHROME_BOTTOM_FADE = 22
export const CHROME_BOTTOM_BLUR_INTENSITY = 28

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
