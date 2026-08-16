import {Image} from 'expo-image'
import {Pressable, StyleSheet, View, useWindowDimensions} from 'react-native'
import Animated, {
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated'
import {useSafeAreaInsets} from 'react-native-safe-area-context'

import {ProgressiveBlurBand} from '@/components/materials/ProgressiveBlurBand'
import {useReduceMotion} from '@/lib/accessibility'
import type {ModulaProfile} from '@/features/profile/contracts/profile'
import {
  applyProfilePhotoMenuAction,
  profilePhotoMenuActions,
} from '@/features/profile/components/profile-photo-menu'
import {
  PROFILE_LAYOUT,
  profileCoverBody,
  profileCoverHeight,
  profilePlateauDepth,
} from '@/features/profile/model/profile-layout'
import {CoverAtmosphere} from '@/platform/ui/atmosphere/cover-atmosphere'
import {InvertedSurfaceTransition} from '@/platform/ui/geometry'
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
  /** Riser between the leading shelf and the raised plateau. */
  stepX?: number
  stepRise?: number
  stepRadius?: number
  avatarCenterX?: number
  avatarCenterY?: number
  cradleRadius?: number
  plateauRadius?: number
}

export const PROFILE_COVER_BODY = profileCoverBody(false)
const TOP_BLUR = PROFILE_LAYOUT.coverTopBlur
const BOTTOM_BLUR = PROFILE_LAYOUT.coverBottomBlur

export {profileCoverBody, profileCoverHeight}

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
  stepX,
  stepRise,
  stepRadius,
  avatarCenterX,
  avatarCenterY,
  cradleRadius,
  plateauRadius = PROFILE_LAYOUT.plateauRadius,
}: ProfileCoverProps) {
  const insets = useSafeAreaInsets()
  const {width} = useWindowDimensions()
  const {colours} = useThemeTokens()
  const reduceMotion = useReduceMotion()
  // NativeTabs still content-insets the first ScrollView even with `never`.
  // Pull the banner into that inset so the photograph sits under the status
  // bar. Parallax lives on the inner artwork, not this node, so the image
  // moves with the layout instead of drifting.
  const height = profileCoverHeight(compact, insets.top, width)
  const uri = previewUri === undefined ? profile.coverUri : previewUri ?? undefined
  const kind = previewKind ?? (uri ? 'photo' : 'gradient')
  const emptyFill = profile.coverColour ?? colours.borderStrong
  const hasPhoto = Boolean(uri) && kind !== 'none'
  const transitionHeight = Math.min(
    cradleRadius != null
      ? Math.round(cradleRadius + plateauRadius)
      : profilePlateauDepth(Boolean(compact), false, width),
    height,
  )

  const animatedStyle = useAnimatedStyle(() => {
    if (reduceMotion) {
      return {transform: [{translateY: 0}, {scale: 1}]}
    }
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
    <View
      accessibilityRole="image"
      accessibilityLabel={`${profile.displayName} profile cover`}
      testID="profile-cover"
      style={[
        styles.cover,
        {
          height,
          marginTop: -insets.top,
          backgroundColor: colours.canvas,
        },
      ]}>
      {/* Only the artwork parallaxes. The canvas step is painted on top of it so
          the silhouette stays welded to the cover's bottom edge while the
          photograph drifts underneath. */}
      <Animated.View style={[StyleSheet.absoluteFill, animatedStyle]}>
        <View
          style={[
            styles.artwork,
            {backgroundColor: kind === 'none' ? colours.canvas : emptyFill},
          ]}>
          {hasPhoto ? (
            <Image
              source={{uri}}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          ) : kind === 'none' ? null : (
            <CoverAtmosphere wash={emptyFill} />
          )}
        </View>
      </Animated.View>
      {hasPhoto ? (
        <View pointerEvents="none" style={[styles.topBlur, {height: insets.top + TOP_BLUR}]}>
          <ProgressiveBlurBand
            height={insets.top + TOP_BLUR}
            topHeavy
            strength="soft"
            intensity={64}
          />
        </View>
      ) : null}
      {hasPhoto ? (
        <View pointerEvents="none" style={[styles.bottomBlur, {bottom: transitionHeight}]}>
          <ProgressiveBlurBand
            height={BOTTOM_BLUR}
            topHeavy={false}
            strength="soft"
            intensity={52}
          />
        </View>
      ) : null}
      <View pointerEvents="none" style={styles.transition}>
        <InvertedSurfaceTransition
          edge="top"
          side="leading"
          size="md"
          avatarSlot="leading"
          raisedSide="trailing"
          width={width}
          height={transitionHeight + 1}
          fill={colours.canvas}
          cornerRadius={stepRadius ?? plateauRadius}
          avatarCenterX={avatarCenterX}
          avatarCenterY={avatarCenterY}
          cradleRadius={cradleRadius}
          plateauRadius={plateauRadius}
          stepX={stepX}
          stepRise={stepRise}
          stepRadius={stepRadius ?? plateauRadius}
        />
      </View>
    </View>
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
        hasPhoto,
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
  artwork: {
    flex: 1,
  },
  bottomBlur: {
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
  transition: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
  },
})
