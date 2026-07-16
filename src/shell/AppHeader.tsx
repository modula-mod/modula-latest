import type {ReactNode} from 'react'
import {useRouter, type Href} from 'expo-router'
import {StyleSheet, View} from 'react-native'
import {useSafeAreaInsets} from 'react-native-safe-area-context'

import {MaterialSurface} from '@/components/materials/MaterialSurface'
import {Avatar} from '@/components/primitives/Avatar'
import {IconButton} from '@/components/primitives/IconButton'
import {AppPressable} from '@/components/primitives/AppPressable'
import {useSession} from '@/auth/runtime'
import {selectionHaptic} from '@/lib/haptics'
import {ModulaWordmark} from '@/shell/ModulaWordmark'
import {useShellDrawer} from '@/shell/ShellDrawerContext'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type AppHeaderProps = {
  centre?: ReactNode
}

export function AppHeader({centre}: AppHeaderProps) {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const {openDrawer} = useShellDrawer()
  const {colours, spacing} = useThemeTokens()

  return (
    <MaterialSurface
      role="navigation"
      style={[
        styles.wrap,
        {
          paddingTop: insets.top,
          borderBottomColor: colours.border,
        },
      ]}>
      <View style={[styles.row, {paddingHorizontal: spacing[4]}]}>
        <AppPressableAvatar onPress={openDrawer} />
        <View style={styles.center}>{centre ?? <ModulaWordmark />}</View>
        <View style={styles.actions}>
          <IconButton
            icon="play"
            label="Open Reels"
            onPress={() => {
              void selectionHaptic()
              router.push('/reels' as Href)
            }}
          />
          <IconButton
            icon="messages"
            label="Open messages"
            onPress={() => router.push('/messages' as Href)}
          />
        </View>
      </View>
    </MaterialSurface>
  )
}

function AppPressableAvatar({onPress}: {onPress: () => void}) {
  const session = useSession()
  const profile = session.status === 'signedIn' ? session.profile : null
  return (
    <AppPressable
      accessibilityLabel="Open Modula drawer"
      onPress={() => {
        void selectionHaptic()
        onPress()
      }}
      style={styles.avatarButton}>
      <Avatar
        name={profile?.displayName ?? (session.status === 'guest' ? 'Guest' : 'Modula')}
        uri={profile?.avatarUri}
        colour={profile?.coverColour}
        size={36}
      />
    </AppPressable>
  )
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
  },
  avatarButton: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  center: {
    alignItems: 'center',
    flex: 1,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 54,
  },
  wrap: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
})
