import {useRouter, type Href} from 'expo-router'
import {useState} from 'react'
import {StyleSheet, View} from 'react-native'
import Animated, {
  runOnJS,
  useAnimatedReaction,
} from 'react-native-reanimated'

import {Avatar} from '@/components/primitives/Avatar'
import {AppIcon} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {useSession} from '@/auth/runtime'
import {selectionHaptic} from '@/lib/haptics'
import {LiquidGlassChrome} from '@/platform/ui/materials/liquid-glass-chrome'
import {shellChromeObscureAmount} from '@/platform/ui/navigation/shell-chrome-obscure'
import {useShellChromeObscureStyle} from '@/platform/ui/navigation/use-shell-chrome-obscure-style'
import {useShellDrawer} from '@/shell/ShellDrawerContext'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function HomeHeaderLeft() {
  const {openDrawer} = useShellDrawer()
  const session = useSession()
  const profile = session.status === 'signedIn' ? session.profile : null
  const obscureStyle = useShellChromeObscureStyle('up')
  const [interactive, setInteractive] = useState(true)

  useAnimatedReaction(
    () => shellChromeObscureAmount(),
    value => {
      runOnJS(setInteractive)(value < 0.4)
    },
    [],
  )

  return (
    <Animated.View
      pointerEvents={interactive ? 'auto' : 'none'}
      style={obscureStyle}>
      <AppPressable
        accessibilityLabel="Open navigation drawer"
        onPress={() => {
          void selectionHaptic()
          openDrawer()
        }}
        style={styles.avatarHit}>
        <Avatar
          name={
            profile?.displayName ??
            (session.status === 'guest' ? 'Guest' : 'Modula')
          }
          uri={profile?.avatarUri}
          colour={profile?.coverColour}
          size={32}
        />
      </AppPressable>
    </Animated.View>
  )
}

export function HomeHeaderRight() {
  const router = useRouter()
  const {colours} = useThemeTokens()
  const obscureStyle = useShellChromeObscureStyle('up')
  const [interactive, setInteractive] = useState(true)

  useAnimatedReaction(
    () => shellChromeObscureAmount(),
    value => {
      runOnJS(setInteractive)(value < 0.4)
    },
    [],
  )

  return (
    <Animated.View
      pointerEvents={interactive ? 'auto' : 'none'}
      style={obscureStyle}>
      <LiquidGlassChrome interactive fallback="clear" style={styles.actionPill}>
        <AppPressable
          accessibilityLabel="Create a post"
          onPress={() => {
            void selectionHaptic()
            router.push('/compose' as Href)
          }}
          style={styles.pillHit}>
          <AppIcon name="create" colour={colours.accent} size={20} />
        </AppPressable>
        <View style={[styles.divider, {backgroundColor: colours.separator}]} />
        <AppPressable
          accessibilityLabel="Open messages"
          onPress={() => router.push('/messages' as Href)}
          style={styles.pillHit}>
          <AppIcon name="messages" colour={colours.text} size={20} />
        </AppPressable>
      </LiquidGlassChrome>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  actionPill: {
    alignItems: 'center',
    borderRadius: 20,
    flexDirection: 'row',
    height: 36,
    marginRight: 4,
    paddingHorizontal: 4,
  },
  avatarHit: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    marginLeft: 4,
    minWidth: 44,
  },
  divider: {
    height: 18,
    marginHorizontal: 2,
    opacity: 0.55,
    width: StyleSheet.hairlineWidth,
  },
  pillHit: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    minWidth: 36,
    paddingHorizontal: 8,
  },
})
