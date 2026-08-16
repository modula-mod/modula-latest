import {Platform, StyleSheet} from 'react-native'
import {LinearGradient} from 'expo-linear-gradient'
import {useSegments} from 'expo-router'
import Animated from 'react-native-reanimated'
import {useSafeAreaInsets} from 'react-native-safe-area-context'

import {shouldHideShellTabBar} from '@/platform/ui/navigation/shell-tab-bar-visibility'
import {useShellChromeObscureStyle} from '@/platform/ui/navigation/use-shell-chrome-obscure-style'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

/**
 * Shell window-edge dissolve from physical `bottom: 0`.
 *
 * The hard blur rectangle behind the floating tabs is liquid-glass on the tab
 * bar itself — not this layer. This wash only paints the screen edge so content
 * under the home indicator does not read as a black gap, and the dissolve
 * originates at the real bottom rather than the pill.
 *
 * No BlurView / MaskedView here: those composite as a hard slab on this edge.
 */
export function ShellBottomProgressiveBlur() {
  const segments = useSegments()
  const insets = useSafeAreaInsets()
  const obscureStyle = useShellChromeObscureStyle('down')
  const {scheme} = useThemeTokens()

  if (Platform.OS === 'ios') {
    return null
  }
  if (shouldHideShellTabBar(segments)) {
    return null
  }

  // From the physical bottom through the home indicator + a short rise.
  const height = Math.max(insets.bottom, 20) + 28

  const colors =
    scheme === 'dark'
      ? ([
          'rgba(11,20,22,0)',
          'rgba(11,20,22,0.22)',
          'rgba(11,20,22,0.5)',
        ] as const)
      : ([
          'rgba(255,255,255,0)',
          'rgba(255,255,255,0.2)',
          'rgba(255,255,255,0.45)',
        ] as const)

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.band, {height}, obscureStyle]}>
      <LinearGradient
        colors={[...colors]}
        locations={[0, 0.42, 1]}
        start={{x: 0, y: 0}}
        end={{x: 0, y: 1}}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  band: {
    bottom: 0,
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
    zIndex: 3,
  },
})
