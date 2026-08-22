import {useRouter, type Href} from 'expo-router'
import {useState} from 'react'
import {StyleSheet, View} from 'react-native'
import Animated, {
  runOnJS,
  useAnimatedReaction,
} from 'react-native-reanimated'

import {AppText} from '@/components/primitives/AppText'
import {selectionHaptic} from '@/lib/haptics'
import {ModulaIconButton} from '@/platform/ui/buttons/modula-icon-button'
import {ChromeGlassControlGroup} from '@/platform/ui/menus/chrome-glass-control-group'
import {
  plainHeaderCustomItem,
  plainHeaderSpacing,
  supportsPlainHeaderItems,
} from '@/platform/ui/navigation/plain-header-items'
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
        <ModulaIconButton
          icon="menu"
          chrome="plain"
          accessibilityLabel="Open navigation drawer"
          testID="home-open-drawer"
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

export function HomeHeaderCreate() {
  const router = useRouter()
  const {obscureStyle, visible} = useShellChromeVisible()

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={obscureStyle}>
      {visible ? (
        <ModulaIconButton
          icon="create"
          chrome="plain"
          accessibilityLabel="Create a post"
          onPress={() => {
            void selectionHaptic()
            router.push('/compose' as Href)
          }}
        />
      ) : null}
    </Animated.View>
  )
}

export function HomeHeaderMessages() {
  const router = useRouter()
  const {obscureStyle, visible} = useShellChromeVisible()

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={obscureStyle}>
      {visible ? (
        <ModulaIconButton
          icon="messages"
          chrome="plain"
          accessibilityLabel="Open messages"
          onPress={() => router.push('/messages' as Href)}
        />
      ) : null}
    </Animated.View>
  )
}

/**
 * Android / web — same shared `ChromeGlassControlGroup` as Product Hub /
 * Profile. iOS uses `homeHeaderRightItems` so UIKit owns the liquid glass.
 */
export function HomeHeaderRight() {
  const router = useRouter()
  return (
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
  )
}

/** iOS 26+: shared liquid glass + spaced icons (not clustered left). */
export function homeHeaderLeftItems() {
  if (!supportsPlainHeaderItems()) return undefined
  return [plainHeaderCustomItem(<HomeHeaderLeft />)]
}

export function homeHeaderRightItems() {
  if (!supportsPlainHeaderItems()) return undefined
  return [
    plainHeaderCustomItem(<HomeHeaderCreate />),
    plainHeaderSpacing(),
    plainHeaderCustomItem(<HomeHeaderMessages />),
  ]
}

const styles = StyleSheet.create({
  titleWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
})
