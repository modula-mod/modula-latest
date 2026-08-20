import {useRouter} from 'expo-router'
import type {StyleProp, ViewStyle} from 'react-native'

import {ModulaIconButton} from '@/platform/ui/buttons/modula-icon-button'
import type {ToolbarChrome} from '@/platform/ui/menus/toolbar-chrome'

type ModulaBackButtonProps = {
  /**
   * `glass` — overlay on artwork / SecondaryScreenHeader (App Store circle).
   * `plain` — glyph inside a native header capsule.
   */
  chrome?: ToolbarChrome
  onPress?: () => void
  accessibilityLabel?: string
  style?: StyleProp<ViewStyle>
  testID?: string
}

/**
 * Global back control. Every pushed / overlay screen uses this — not a raw
 * chevron and not a one-off circle. Same 44pt hit as share and overflow.
 *
 * Reference: App Store product-page overlay (circular glass chevron) and
 * iOS 26 plain glyphs inside the shared header capsule.
 */
export function ModulaBackButton({
  chrome = 'glass',
  onPress,
  accessibilityLabel = 'Go back',
  style,
  testID = 'modula-back',
}: ModulaBackButtonProps) {
  const router = useRouter()

  return (
    <ModulaIconButton
      icon="back"
      chrome={chrome}
      accessibilityLabel={accessibilityLabel}
      style={style}
      testID={testID}
      onPress={() => {
        if (onPress) {
          onPress()
          return
        }
        if (router.canGoBack()) {
          router.back()
          return
        }
        router.replace('/' as never)
      }}
    />
  )
}
