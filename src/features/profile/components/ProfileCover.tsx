import {Image} from 'expo-image'
import {LinearGradient} from 'expo-linear-gradient'
import {Pressable, StyleSheet, View} from 'react-native'
import Animated, {
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated'
import {useSafeAreaInsets} from 'react-native-safe-area-context'

import {AppText} from '@/components/primitives/AppText'
import type {ModulaProfile} from '@/features/profile/contracts/profile'
import {CoverAtmosphere} from '@/platform/ui/atmosphere/cover-atmosphere'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type ProfileCoverProps = {
  profile: ModulaProfile
  compact?: boolean
  canEdit?: boolean
  onEditPress?: () => void
  previewUri?: string | null
  previewKind?: 'photo' | 'gradient' | 'solid' | 'none'
  /** Scroll offset for X-style parallax / collapse. */
  scrollY?: SharedValue<number>
}

export function ProfileCover({
  profile,
  compact,
  canEdit,
  onEditPress,
  previewUri,
  previewKind,
  scrollY,
}: ProfileCoverProps) {
  const insets = useSafeAreaInsets()
  const {colours, spacing} = useThemeTokens()
  const baseHeight = compact ? 168 : 200
  const height = baseHeight + insets.top
  const uri = previewUri === undefined ? profile.coverUri : previewUri ?? undefined
  const kind = previewKind ?? (uri ? 'photo' : 'gradient')

  const animatedStyle = useAnimatedStyle(() => {
    const y = scrollY?.value ?? 0
    return {
      transform: [
        {
          translateY: interpolate(y, [0, height], [0, -height * 0.45], 'clamp'),
        },
        {
          scale: interpolate(y, [-120, 0], [1.35, 1], 'clamp'),
        },
      ],
    }
  })

  const body = (
    <Animated.View
      accessibilityRole="image"
      accessibilityLabel={`${profile.displayName} profile cover`}
      style={[
        styles.cover,
        {
          height,
          backgroundColor:
            kind === 'none' ? colours.surface2 : profile.coverColour ?? colours.accentSubtle,
          borderBottomColor: colours.border,
        },
        animatedStyle,
      ]}>
      {uri && kind !== 'none' ? (
        <Image
          source={{uri}}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
      ) : kind === 'none' ? null : (
        <CoverAtmosphere wash={profile.coverColour ?? colours.surfaceRaised} ink={colours.text} paper={colours.surface} />
      )}
      <LinearGradient
        colors={['rgba(0,0,0,0.25)', 'transparent', 'rgba(0,0,0,0.2)']}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {canEdit ? (
        <View
          style={[
            styles.editChip,
            {
              backgroundColor: colours.mediaOverlayControlBackground,
              bottom: spacing[3],
              right: spacing[3],
            },
          ]}>
          <AppText variant="caption" style={{color: colours.mediaOverlayText}}>
            Edit Cover
          </AppText>
        </View>
      ) : null}
    </Animated.View>
  )

  if (!canEdit || !onEditPress) {
    return body
  }

  return (
    <Pressable
      accessibilityLabel="Edit profile cover"
      accessibilityRole="button"
      onPress={onEditPress}>
      {body}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  cover: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    width: '100%',
  },
  editChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    position: 'absolute',
    zIndex: 2,
  },
})
