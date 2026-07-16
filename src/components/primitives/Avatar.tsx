import {Image} from 'expo-image'
import {
  StyleSheet,
  View,
  type ImageStyle,
  type StyleProp,
  type ViewStyle,
} from 'react-native'

import {AppText} from '@/components/primitives/AppText'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type AvatarProps = {
  name: string
  uri?: string
  size?: number
  colour?: string
  style?: StyleProp<ViewStyle>
}

function initialsFor(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('')
}

export function Avatar({name, uri, size = 40, colour, style}: AvatarProps) {
  const {colours} = useThemeTokens()
  const avatarRadius = size / 2

  if (uri) {
    return (
      <Image
        source={{uri}}
        style={[
          styles.image,
          {height: size, width: size, borderRadius: avatarRadius},
          style as StyleProp<ImageStyle>,
        ]}
        contentFit="cover"
        accessibilityLabel={`${name} avatar`}
      />
    )
  }

  return (
    <View
      style={[
        styles.initials,
        {
          height: size,
          width: size,
          borderRadius: avatarRadius,
          backgroundColor: colour ?? colours.accentSubtle,
          borderColor: colours.border,
        },
        style,
      ]}
      accessibilityRole="image"
      accessibilityLabel={`${name} avatar`}>
      <AppText
        variant="label"
        style={{
          color: colour ? colours.accentForeground : colours.accent,
          fontSize: Math.max(12, size * 0.34),
        }}>
        {initialsFor(name)}
      </AppText>
    </View>
  )
}

const styles = StyleSheet.create({
  image: {
    overflow: 'hidden',
  },
  initials: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
  },
})
