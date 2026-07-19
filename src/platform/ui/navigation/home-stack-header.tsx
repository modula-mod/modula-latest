import {useRouter, type Href} from 'expo-router'
import {useState} from 'react'
import {StyleSheet} from 'react-native'
import Animated, {
  runOnJS,
  useAnimatedReaction,
} from 'react-native-reanimated'

import {AppText} from '@/components/primitives/AppText'
import {selectionHaptic} from '@/lib/haptics'
import {ModulaIconButton} from '@/platform/ui/buttons/modula-icon-button'
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

export function HomeHeaderLeft() {
  const {openDrawer} = useShellDrawer()
  const {obscureStyle, visible} = useShellChromeVisible()

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={obscureStyle}>
      {visible ? (
        // Expo UI plain icon button — circle glyph, no glass / filled chrome.
        <ModulaIconButton
          icon="menu"
          chrome="plain"
          accessibilityLabel="Open navigation drawer"
          onPress={() => {
            void selectionHaptic()
            openDrawer()
          }}
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

/** Plain Expo UI icon actions — no glass / filled disc. */
export function HomeHeaderRight() {
  const router = useRouter()
  const {obscureStyle, visible} = useShellChromeVisible()

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={[styles.rightRow, obscureStyle]}>
      {visible ? (
        <>
          <ModulaIconButton
            icon="create"
            chrome="plain"
            accessibilityLabel="Create a post"
            onPress={() => {
              void selectionHaptic()
              router.push('/compose' as Href)
            }}
          />
          <ModulaIconButton
            icon="messages"
            chrome="plain"
            accessibilityLabel="Open messages"
            onPress={() => router.push('/messages' as Href)}
          />
        </>
      ) : null}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  rightRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginRight: 4,
  },
  titleWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
})
