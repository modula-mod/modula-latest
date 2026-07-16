import {Image} from 'expo-image'
import {LinearGradient} from 'expo-linear-gradient'
import {Pressable, StyleSheet, View} from 'react-native'

import {AppText} from '@/components/primitives/AppText'
import type {ModulaProfile} from '@/features/profile/contracts/profile'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type ProfileCoverProps = {
  profile: ModulaProfile
  compact?: boolean
  canEdit?: boolean
  onEditPress?: () => void
  /** Local preview override while editing. */
  previewUri?: string | null
  previewKind?: 'photo' | 'gradient' | 'solid' | 'none'
}

export function ProfileCover({
  profile,
  compact,
  canEdit,
  onEditPress,
  previewUri,
  previewKind,
}: ProfileCoverProps) {
  const {colours, spacing} = useThemeTokens()
  const height = compact ? 180 : 210
  const uri = previewUri === undefined ? profile.coverUri : previewUri ?? undefined
  const kind = previewKind ?? (uri ? 'photo' : 'gradient')

  const body = (
    <View
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
      ]}>
      {uri && kind !== 'none' ? (
        <Image
          source={{uri}}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
      ) : kind === 'none' ? null : (
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
        style={[styles.scrim, {backgroundColor: colours.backdrop, pointerEvents: 'none'}]}
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
    </View>
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
  },
  editChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    position: 'absolute',
  },
  scrim: {
    bottom: 0,
    left: 0,
    opacity: 0.12,
    position: 'absolute',
    right: 0,
    top: 0,
  },
})
