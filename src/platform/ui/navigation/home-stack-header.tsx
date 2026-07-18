import {useRouter, type Href} from 'expo-router'
import {Pressable} from 'react-native'

import {Avatar} from '@/components/primitives/Avatar'
import {AppIcon} from '@/components/primitives/AppIcon'
import {useSession} from '@/auth/runtime'
import {selectionHaptic} from '@/lib/haptics'
import {useShellDrawer} from '@/shell/ShellDrawerContext'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function HomeHeaderLeft() {
  const {openDrawer} = useShellDrawer()
  const session = useSession()
  const profile = session.status === 'signedIn' ? session.profile : null

  return (
    <Pressable
      accessibilityLabel="Open navigation drawer"
      onPress={() => {
        void selectionHaptic()
        openDrawer()
      }}
      style={{
        alignItems: 'center',
        height: 44,
        justifyContent: 'center',
        marginLeft: 4,
        width: 44,
      }}>
      <Avatar
        name={profile?.displayName ?? (session.status === 'guest' ? 'Guest' : 'Modula')}
        uri={profile?.avatarUri}
        colour={profile?.coverColour}
        size={32}
      />
    </Pressable>
  )
}

export function HomeHeaderRight() {
  const router = useRouter()
  const {colours} = useThemeTokens()

  return (
    <>
      <Pressable
        accessibilityLabel="Create a post"
        onPress={() => {
          void selectionHaptic()
          router.push('/compose' as Href)
        }}
        style={{
          alignItems: 'center',
          height: 44,
          justifyContent: 'center',
          width: 44,
        }}>
        <AppIcon name="create" colour={colours.accent} size={22} />
      </Pressable>
      <Pressable
        accessibilityLabel="Open messages"
        onPress={() => router.push('/messages' as Href)}
        style={{
          alignItems: 'center',
          height: 44,
          justifyContent: 'center',
          width: 44,
        }}>
        <AppIcon name="messages" colour={colours.textSecondary} size={22} />
      </Pressable>
    </>
  )
}
