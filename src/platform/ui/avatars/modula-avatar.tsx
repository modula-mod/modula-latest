import {StyleSheet, View} from 'react-native'

import {Avatar} from '@/components/primitives/Avatar'
import type {PresenceStatus} from '@/platform/ui/avatars/types'
import {SkeletonBlock} from '@/platform/ui/skeletons/SkeletonBlock'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type ModulaAvatarSize = 'small' | 'medium' | 'large' | 'profile'

const AVATAR_SIZE: Record<ModulaAvatarSize, number> = {
  small: 28,
  medium: 40,
  large: 56,
  profile: 88,
}

export function ModulaAvatar({
  name,
  uri,
  colour,
  size = 'medium',
  presence,
  focusHalo = false,
  loading = false,
}: {
  name: string
  uri?: string
  colour?: string
  size?: ModulaAvatarSize | number
  presence?: PresenceStatus
  focusHalo?: boolean
  loading?: boolean
}) {
  const {colours} = useThemeTokens()
  const edge = typeof size === 'number' ? size : AVATAR_SIZE[size]
  const dot = Math.max(10, Math.round(edge * 0.28))
  const presenceColour =
    presence === 'online'
      ? colours.success
      : presence === 'away'
        ? colours.warning
        : presence === 'busy'
          ? colours.destructive
          : colours.textMuted

  return (
    <View
      style={[
        styles.root,
        {
          borderColor: focusHalo ? colours.accent : 'transparent',
          borderRadius: edge / 2,
          borderWidth: focusHalo ? 2 : 0,
          height: edge,
          width: edge,
        },
      ]}>
      {loading ? (
        <SkeletonBlock borderRadius={edge / 2} height={edge} width={edge} />
      ) : (
        <Avatar colour={colour} name={name} size={focusHalo ? edge - 6 : edge} uri={uri} />
      )}
      {presence ? (
        <View
          accessibilityLabel={`${name} is ${presence}`}
          accessibilityRole="text"
          style={[
            styles.presence,
            {
              backgroundColor: presenceColour,
              borderColor: colours.canvas,
              borderRadius: dot / 2,
              height: dot,
              width: dot,
            },
          ]}
        />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  presence: {
    bottom: 1,
    position: 'absolute',
    right: 1,
  },
  root: {
    alignItems: 'center',
    borderWidth: 2,
    justifyContent: 'center',
  },
})
