import {StyleSheet, View} from 'react-native'

import {Avatar} from '@/components/primitives/Avatar'
import type {PresenceStatus} from '@/platform/ui/avatars/types'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type PresenceAvatarProps = {
  name: string
  uri?: string
  colour?: string
  size?: number
  status?: PresenceStatus
}

const STATUS_COLOUR: Record<PresenceStatus, string> = {
  online: '#34C759',
  away: '#FFD60A',
  busy: '#FF453A',
  offline: '#8E8E93',
}

/**
 * Avatar with a presence ring/dot. Extension point for Messages / share contacts.
 */
export function PresenceAvatar({
  name,
  uri,
  colour,
  size = 40,
  status = 'offline',
}: PresenceAvatarProps) {
  const {colours} = useThemeTokens()
  const dot = Math.max(10, size * 0.28)

  return (
    <View style={{height: size, width: size}}>
      <Avatar name={name} uri={uri} colour={colour} size={size} />
      <View
        style={[
          styles.dot,
          {
            backgroundColor: STATUS_COLOUR[status],
            borderColor: colours.canvas,
            borderRadius: dot / 2,
            height: dot,
            width: dot,
          },
        ]}
        accessibilityLabel={`${name} is ${status}`}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  dot: {
    borderWidth: 2,
    bottom: 0,
    position: 'absolute',
    right: 0,
  },
})
