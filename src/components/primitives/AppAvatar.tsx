import {StyleSheet, View} from 'react-native'

import {AppImage} from '@/components/primitives/AppImage'
import {AppText} from '@/components/primitives/AppText'
import {useTheme} from '@/theme/runtime/useTheme'

type AppAvatarProps = {
  uri?: string
  name?: string
  size?: number
}

function initials(name?: string): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  const letters = parts.slice(0, 2).map(p => p[0]?.toUpperCase() ?? '')
  return letters.join('') || '?'
}

export function AppAvatar({uri, name, size = 40}: AppAvatarProps) {
  const {colours, radius} = useTheme()

  if (uri) {
    return (
      <AppImage
        source={{uri}}
        style={{
          width: size,
          height: size,
          borderRadius: radius.full,
          backgroundColor: colours.surface,
        }}
        accessibilityLabel={name ? `${name} avatar` : 'Avatar'}
      />
    )
  }

  return (
    <View
      accessibilityLabel={name ? `${name} avatar` : 'Avatar'}
      style={[
        styles.fallback,
        {
          width: size,
          height: size,
          borderRadius: radius.full,
          backgroundColor: colours.accent,
        },
      ]}>
      <AppText
        variant="caption"
        colour="accentForeground"
        style={{fontSize: size * 0.35, lineHeight: size * 0.4}}>
        {initials(name)}
      </AppText>
    </View>
  )
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
})
