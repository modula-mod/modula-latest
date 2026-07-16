import {StyleSheet, View} from 'react-native'

import {Avatar} from '@/components/primitives/Avatar'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type StoryRingAvatarProps = {
  name: string
  uri?: string
  colour?: string
  size?: number
  /** Unseen story ring uses accent; seen uses muted border. */
  seen?: boolean
  ringWidth?: number
}

/**
 * Story-style ring around an avatar for Home story rail.
 * Extension point: animate ring later without Reanimated (LayoutAnimation / Pressable).
 */
export function StoryRingAvatar({
  name,
  uri,
  colour,
  size = 56,
  seen = false,
  ringWidth = 2.5,
}: StoryRingAvatarProps) {
  const {colours} = useThemeTokens()
  const inner = size - ringWidth * 4

  return (
    <View
      style={[
        styles.ring,
        {
          borderColor: seen ? colours.border : colours.accent,
          borderRadius: size / 2,
          borderWidth: ringWidth,
          height: size,
          padding: ringWidth,
          width: size,
        },
      ]}
      accessibilityLabel={`${name} story${seen ? '' : ', new'}`}>
      <Avatar name={name} uri={uri} colour={colour} size={inner} />
    </View>
  )
}

const styles = StyleSheet.create({
  ring: {
    alignItems: 'center',
    justifyContent: 'center',
  },
})
