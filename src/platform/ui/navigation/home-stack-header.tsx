import {useRouter, type Href} from 'expo-router'
import {useState} from 'react'
import {StyleSheet} from 'react-native'
import Animated, {
  runOnJS,
  useAnimatedReaction,
} from 'react-native-reanimated'

import {AppText} from '@/components/primitives/AppText'
import {selectionHaptic} from '@/lib/haptics'
import {ChromeGlassControlGroup} from '@/platform/ui/menus/chrome-glass-control-group'
import {shellChromeObscureAmount} from '@/platform/ui/navigation/shell-chrome-obscure'
import {useShellChromeObscureStyle} from '@/platform/ui/navigation/use-shell-chrome-obscure-style'
import {useShellDrawer} from '@/shell/ShellDrawerContext'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

function useShellChromeVisible(threshold = 0.2) {
  const obscureStyle = useShellChromeObscureStyle('up')
  const [visible, setVisible] = useState(true)

  useAnimatedReaction(
    () => shellChromeObscureAmount(),
    value => {
      // Glass / header chrome often ignores parent opacity — unmount when pulled.
      runOnJS(setVisible)(value < threshold)
    },
    [threshold],
  )

  return {obscureStyle, visible}
}

/** Leading Home control — shared liquid-glass capsule (single glyph). */
export function HomeHeaderLeft() {
  const {openDrawer} = useShellDrawer()
  const {obscureStyle, visible} = useShellChromeVisible()

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={obscureStyle}>
      {visible ? (
        <ChromeGlassControlGroup
          items={[
            {
              kind: 'button',
              icon: 'menu',
              accessibilityLabel: 'Open navigation drawer',
              onPress: () => {
                void selectionHaptic()
                openDrawer()
              },
            },
          ]}
        />
      ) : null}
    </Animated.View>
  )
}

export function HomeHeaderTitle() {
  const {colours} = useThemeTokens()
  const {obscureStyle, visible} = useShellChromeVisible()

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.titleWrap, obscureStyle]}>
      {visible ? (
        <AppText variant="headline" style={{color: colours.text}}>
          Modula
        </AppText>
      ) : null}
    </Animated.View>
  )
}

/**
 * Trailing Home control group — same `ChromeGlassControlGroup` as Product Hub /
 * Profile / Activity. Inner glyphs are chrome="plain" inside one liquid-glass capsule.
 */
export function HomeHeaderRight() {
  const router = useRouter()
  const {obscureStyle, visible} = useShellChromeVisible()

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={obscureStyle}>
      {visible ? (
        <ChromeGlassControlGroup
          items={[
            {
              kind: 'button',
              icon: 'create',
              accessibilityLabel: 'Create a post',
              onPress: () => {
                void selectionHaptic()
                router.push('/compose' as Href)
              },
            },
            {
              kind: 'button',
              icon: 'messages',
              accessibilityLabel: 'Open messages',
              onPress: () => router.push('/messages' as Href),
            },
          ]}
        />
      ) : null}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  titleWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
})
