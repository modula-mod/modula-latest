import {Image} from 'expo-image'
import {Pressable, StyleSheet, View, useWindowDimensions} from 'react-native'
import {useSafeAreaInsets} from 'react-native-safe-area-context'

import {ProgressiveBlurBand} from '@/components/materials/ProgressiveBlurBand'
import type {ModulaProfile} from '@/features/profile/contracts/profile'
import {
  applyProfilePhotoMenuAction,
  profilePhotoMenuActions,
} from '@/features/profile/components/profile-photo-menu'
import {
  PROFILE_LAYOUT,
  profileCoverBody,
  profileCoverHeight,
} from '@/features/profile/model/profile-layout'
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
  onPhotoUri?: (uri: string) => void
  onPhotoRemove?: () => void
}

export const PROFILE_COVER_BODY = profileCoverBody(false)
const TOP_BLUR = PROFILE_LAYOUT.coverTopBlur

export {profileCoverBody, profileCoverHeight}

export function ProfileCover({
  profile,
  compact,
  canEdit,
  onEditPress,
  previewUri,
  previewKind,
  onPhotoUri,
  onPhotoRemove,
}: ProfileCoverProps) {
  const insets = useSafeAreaInsets()
  const {width} = useWindowDimensions()
  const {colours} = useThemeTokens()
  // NativeTabs still content-insets the first ScrollView even with `never`.
  // Pull the banner into that inset so the photograph sits under the status
  // bar. No transform on this tree — a parallax layer desyncs the avatar
  // and identity on a fast fling. The inverted pocket is painted in the
  // hero body so it shares coordinates with the portrait.
  const height = profileCoverHeight(compact, insets.top, width)
  const uri = previewUri === undefined ? profile.coverUri : previewUri ?? undefined
  const kind = previewKind ?? (uri ? 'photo' : 'gradient')
  const emptyFill = profile.coverColour ?? colours.borderStrong
  const hasPhoto = Boolean(uri) && kind !== 'none'

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
      <View collapsable={false} style={StyleSheet.absoluteFill}>
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
      </View>
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
