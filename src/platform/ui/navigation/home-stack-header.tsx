import {useRouter, type Href} from 'expo-router'
import {useState} from 'react'
import {StyleSheet} from 'react-native'
import Animated, {
  runOnJS,
  useAnimatedReaction,
} from 'react-native-reanimated'

import {Avatar} from '@/components/primitives/Avatar'
import {AppIcon} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {useSession} from '@/auth/runtime'
import {selectionHaptic} from '@/lib/haptics'
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
  const session = useSession()
  const profile = session.status === 'signedIn' ? session.profile : null
  const {obscureStyle, visible} = useShellChromeVisible()

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={obscureStyle}>
      {visible ? (
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
            style={styles.avatarBare}
          />
        </AppPressable>
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

/** Plain icon actions — no glass disc behind the glyph. */
export function HomeHeaderRight() {
  const router = useRouter()
  const {colours} = useThemeTokens()
  const {obscureStyle, visible} = useShellChromeVisible()

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={[styles.rightRow, obscureStyle]}>
      {visible ? (
        <>
          <AppPressable
            accessibilityLabel="Create a post"
            onPress={() => {
              void selectionHaptic()
              router.push('/compose' as Href)
            }}
            style={styles.iconHit}>
            <AppIcon name="create" colour={colours.accent} size={22} />
          </AppPressable>
          <AppPressable
            accessibilityLabel="Open messages"
            onPress={() => router.push('/messages' as Href)}
            style={styles.iconHit}>
            <AppIcon name="messages" colour={colours.text} size={22} />
          </AppPressable>
        </>
      ) : null}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  avatarBare: {
    borderWidth: 0,
  },
  avatarHit: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    marginLeft: 4,
    minWidth: 44,
  },
  iconHit: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    minWidth: 40,
    paddingHorizontal: 6,
  },
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
