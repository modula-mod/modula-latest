import {StyleSheet, View} from 'react-native'

import {Avatar} from '@/components/primitives/Avatar'
import type {AvatarFace} from '@/platform/ui/avatars/types'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type GroupFacesProps = {
  faces: AvatarFace[]
  size?: number
}

/**
 * 2×2 group face grid (up to 4) for communities / share sheet contacts.
 */
export function GroupFaces({faces, size = 48}: GroupFacesProps) {
  const {colours, radius} = useThemeTokens()
  const cell = size / 2 - 1
  const shown = faces.slice(0, 4)

  return (
    <View
      style={[
        styles.grid,
        {
          backgroundColor: colours.surfaceRaised,
          borderRadius: radius.medium,
          height: size,
          width: size,
        },
      ]}
      accessibilityLabel={`Group of ${faces.length}`}>
      {shown.map(face => (
        <Avatar
          key={face.id}
          name={face.name}
          uri={face.uri}
          colour={face.colour}
          size={cell}
          style={styles.cell}
        />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  cell: {
    margin: 0.5,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    overflow: 'hidden',
  },
})
