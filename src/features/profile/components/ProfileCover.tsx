import {Image} from 'expo-image'
import {LinearGradient} from 'expo-linear-gradient'
import {StyleSheet, View} from 'react-native'

import type {ModulaProfile} from '@/features/profile/contracts/profile'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type ProfileCoverProps = {
  profile: ModulaProfile
  compact?: boolean
}

export function ProfileCover({profile, compact}: ProfileCoverProps) {
  const {colours} = useThemeTokens()
  const height = compact ? 152 : 210

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={`${profile.displayName} profile cover`}
      style={[
        styles.cover,
        {
          height,
          backgroundColor: profile.coverColour ?? colours.accentSubtle,
          borderBottomColor: colours.border,
        },
      ]}>
      {profile.coverUri ? (
        <Image
          source={{uri: profile.coverUri}}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
      ) : (
        <LinearGradient
          colors={[
            profile.coverColour ?? colours.accentSubtle,
            colours.surfaceRaised,
          ]}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 1}}
          style={StyleSheet.absoluteFill}
        />
      )}
      <View
        pointerEvents="none"
        style={[styles.scrim, {backgroundColor: colours.backdrop}]}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  cover: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  scrim: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    opacity: 0.12,
  },
})
