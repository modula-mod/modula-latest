import {StyleSheet, View} from 'react-native'

import {Avatar} from '@/components/primitives/Avatar'
import {AppText} from '@/components/primitives/AppText'
import type {AvatarFace} from '@/platform/ui/avatars/types'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type StackedAvatarsProps = {
  faces: AvatarFace[]
  size?: number
  max?: number
  overlap?: number
}

/**
 * Overlapping face stack for Activity groups, Discover trending, share sheets.
 * Extension point: pass more faces; overflow renders +N.
 */
export function StackedAvatars({
  faces,
  size = 32,
  max = 3,
  overlap = 10,
}: StackedAvatarsProps) {
  const {colours} = useThemeTokens()
  const visible = faces.slice(0, max)
  const overflow = Math.max(0, faces.length - max)

  return (
    <View
      style={[styles.row, {height: size, width: size + (visible.length - 1) * (size - overlap) + (overflow ? size - overlap : 0)}]}
      accessibilityLabel={`${faces.length} people`}>
      {visible.map((face, index) => (
        <View
          key={face.id}
          style={[
            styles.face,
            {
              borderColor: colours.canvas,
              borderRadius: size / 2,
              left: index * (size - overlap),
              zIndex: visible.length - index,
            },
          ]}>
          <Avatar name={face.name} uri={face.uri} colour={face.colour} size={size} />
        </View>
      ))}
      {overflow > 0 ? (
        <View
          style={[
            styles.overflow,
            {
              backgroundColor: colours.surfaceRaised,
              borderColor: colours.canvas,
              borderRadius: size / 2,
              height: size,
              left: visible.length * (size - overlap),
              width: size,
            },
          ]}>
          <AppText variant="caption" style={{color: colours.textSecondary, fontSize: size * 0.32}}>
            +{overflow}
          </AppText>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  face: {
    borderWidth: 2,
    position: 'absolute',
    top: 0,
  },
  overflow: {
    alignItems: 'center',
    borderWidth: 2,
    justifyContent: 'center',
    position: 'absolute',
    top: 0,
  },
  row: {
    position: 'relative',
  },
})
