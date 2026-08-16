import {Image} from 'expo-image'
import {Pressable, StyleSheet, View} from 'react-native'
import Animated, {
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated'
import {useSafeAreaInsets} from 'react-native-safe-area-context'

import {ProgressiveBlurBand} from '@/components/materials/ProgressiveBlurBand'
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

/** Banner height below the status bar (X / Bluesky / LinkedIn). */
export const PROFILE_COVER_BODY = 180
const TOP_BLUR = 28
const BOTTOM_BLUR = 72

export function profileCoverBody(compact: boolean | undefined) {
  return compact ? 156 : PROFILE_COVER_BODY
}

export function profileCoverHeight(compact: boolean | undefined, insetTop: number) {
  return profileCoverBody(compact) + insetTop
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
  const height = profileCoverHeight(compact, insets.top)
  const uri = previewUri === undefined ? profile.coverUri : previewUri ?? undefined
  const kind = previewKind ?? (uri ? 'photo' : 'gradient')
  const emptyFill = profile.coverColour ?? colours.borderStrong

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
      testID="profile-cover"
      style={[
        styles.cover,
        {
          height,
          // NativeTabs still applies a top content inset to the first ScrollView
          // even with `never`; pull the banner into that inset so it sits under
          // the status bar (X / Bluesky / LinkedIn).
          marginTop: -insets.top,
          backgroundColor: kind === 'none' ? colours.canvas : emptyFill,
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
        <CoverAtmosphere wash={emptyFill} />
      )}
      {uri && kind !== 'none' ? (
        <View pointerEvents="none" style={[styles.topBlur, {height: insets.top + TOP_BLUR}]}>
          <ProgressiveBlurBand
            height={insets.top + TOP_BLUR}
            topHeavy
            strength="soft"
            intensity={64}
          />
        </View>
      ) : null}
      <View pointerEvents="none" style={styles.bottomBlur}>
        <ProgressiveBlurBand
          height={BOTTOM_BLUR}
          topHeavy={false}
          strength="soft"
          intensity={52}
        />
      </View>
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
  bottomBlur: {
    bottom: 0,
    height: BOTTOM_BLUR,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  cover: {
    overflow: 'hidden',
    width: '100%',
  },
  topBlur: {
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
})
