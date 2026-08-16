import {Image} from 'expo-image'
import {LinearGradient} from 'expo-linear-gradient'
import {Pressable, StyleSheet} from 'react-native'
import Animated, {
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated'
import {useSafeAreaInsets} from 'react-native-safe-area-context'

import type {ModulaProfile} from '@/features/profile/contracts/profile'
import {
  applyProfilePhotoMenuAction,
  profilePhotoMenuActions,
} from '@/features/profile/components/profile-photo-menu'
import {CoverAtmosphere} from '@/platform/ui/atmosphere/cover-atmosphere'
import {ModulaContextMenu} from '@/platform/ui/menus/modula-context-menu'
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
  onPhotoUri?: (uri: string) => void
  onPhotoRemove?: () => void
}

export function ProfileCover({
  profile,
  compact,
  canEdit,
  onEditPress,
  previewUri,
  previewKind,
  scrollY,
  onPhotoUri,
  onPhotoRemove,
}: ProfileCoverProps) {
  const insets = useSafeAreaInsets()
  const {colours} = useThemeTokens()
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
    </Animated.View>
  )

  if (!canEdit) {
    return body
  }

  const trigger = onEditPress ? (
    <Pressable
      accessibilityLabel="Edit profile cover"
      accessibilityRole="button"
      onPress={onEditPress}>
      {body}
    </Pressable>
  ) : (
    body
  )

  if (!onPhotoUri || !onPhotoRemove) {
    return trigger
  }

  const applyUri = onPhotoUri
  const applyRemove = onPhotoRemove

  return (
    <ModulaContextMenu
      fit="fill"
      accessibilityLabel="Cover photo actions"
      title="Cover photo"
      actions={profilePhotoMenuActions({
        hasPhoto: Boolean(uri) && kind !== 'none',
        removeLabel: 'Remove cover image',
      })}
      onAction={id => {
        void applyProfilePhotoMenuAction({
          actionId: id,
          target: 'cover',
          onUri: applyUri,
          onRemove: applyRemove,
        })
      }}>
      {trigger}
    </ModulaContextMenu>
  )
}

const styles = StyleSheet.create({
  cover: {
    overflow: 'hidden',
    width: '100%',
  },
})
