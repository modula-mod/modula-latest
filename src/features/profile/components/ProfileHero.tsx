import {useState} from 'react'
import {StyleSheet, View, useWindowDimensions} from 'react-native'
import type {SharedValue} from 'react-native-reanimated'

import type {
  ModulaProfile,
  ProfilePresentationPreferences,
  ProfileViewerContext,
} from '@/features/profile/contracts/profile'
import {AppText} from '@/components/primitives/AppText'
import {useUpdateProfileMutation} from '@/features/profile/data-query'
import {ProfileActions} from '@/features/profile/components/ProfileActions'
import {ProfileAvatar} from '@/features/profile/components/ProfileAvatar'
import {ProfileCover} from '@/features/profile/components/ProfileCover'
import {ProfileBio, ProfileIdentity} from '@/features/profile/components/ProfileIdentity'
import {ProfileMetadataGrid} from '@/features/profile/components/ProfileMetadataGrid'
import {ProfileStats} from '@/features/profile/components/ProfileStats'
import {
  ProfileAvatarEditor,
  type ProfileAvatarDraft,
} from '@/features/profile/editor/profile-avatar-editor'
import {
  ProfileCoverEditor,
  type ProfileCoverDraft,
} from '@/features/profile/editor/profile-cover-editor'
import {profileGeometry} from '@/features/profile/model/profile-layout'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type ProfileHeroProps = {
  profile: ModulaProfile
  viewer: ProfileViewerContext
  presentation: ProfilePresentationPreferences
  ownerHandle: string
  showStats?: boolean
  showActions?: boolean
  compact?: boolean
  onSelectTab: (tabId: string) => void
  scrollY?: SharedValue<number>
}

/**
 * Cover is full-bleed from the status bar. Cover photos stay `expo-image` —
 * `@expo/ui` Image is SF Symbols only (Expo SDK 57 docs).
 *
 * The canvas steps with a G1 inverted cradle around the portrait. Identity
 * starts at the white plateau's leading edge, beside the pocket.
 */
export function ProfileHero({
  profile,
  viewer,
  presentation,
  ownerHandle,
  showStats = true,
  showActions = true,
  compact,
  onSelectTab,
  scrollY,
}: ProfileHeroProps) {
  const {width, fontScale} = useWindowDimensions()
  const {colours, spacing} = useThemeTokens()
  const updateProfile = useUpdateProfileMutation()
  // Phones stay on the compact scale even when the layout id is not `minimal`.
  const isCompact = compact || width < 760
  const geometry = profileGeometry(isCompact, presentation.showFocusHalo, spacing[4], {
    contentWidth: width,
    fontScale,
  })
  const canEdit = viewer.canEdit
  const stacked = geometry.stackedFallback

  const [coverEditorOpen, setCoverEditorOpen] = useState(false)
  const [avatarEditorOpen, setAvatarEditorOpen] = useState(false)
  const [coverDraft, setCoverDraft] = useState<ProfileCoverDraft | null>(null)
  const [avatarDraft, setAvatarDraft] = useState<ProfileAvatarDraft | null>(null)

  const identity = (
    <ProfileIdentity profile={profile} viewer={viewer} compact emphasis="hero" />
  )
  const info = (
    <View style={[styles.infoColumn, {gap: spacing[2]}]}>
      <ProfileBio profile={profile} compact />
      <ProfileMetadataGrid profile={profile} viewer={viewer} />
      {showActions && !viewer.canEdit ? (
        <View style={styles.visitorActions}>
          <ProfileActions profile={profile} viewer={viewer} />
        </View>
      ) : null}
      <HeroViewingCopy viewer={viewer} />
    </View>
  )
  const stats = showStats ? (
    <ProfileStats
      key={profile.id}
      profile={profile}
      ownerHandle={ownerHandle}
      presentation={presentation}
      onSelectTab={onSelectTab}
      isOwner={viewer.canEdit}
    />
  ) : null

  const avatar = (
    <ProfileAvatar
      profile={profile}
      size={geometry.avatarSize}
      showFocusHalo={presentation.showFocusHalo}
      canEdit={canEdit}
      onEditPress={() => setAvatarEditorOpen(true)}
      previewUri={avatarDraft ? avatarDraft.uri : undefined}
      onPhotoUri={uri => {
        setAvatarDraft({uri, sourceUri: uri})
        const avatarUri = canonicalProfileMediaUri(uri, profile.avatarUri)
        if (avatarUri === undefined) return
        void updateProfile.mutateAsync({avatarUri})
      }}
      onPhotoRemove={() => {
        setAvatarDraft({uri: null, sourceUri: null})
        if (!profile.avatarUri) return
        void updateProfile.mutateAsync({avatarUri: null})
      }}
    />
  )

  return (
    <View style={[styles.wrap, {backgroundColor: colours.canvas}]}>
      <View style={styles.coverBlock}>
        <ProfileCover
          profile={profile}
          compact={isCompact}
          canEdit={canEdit}
          stepX={geometry.stepX}
          stepRise={geometry.stepRise}
          stepRadius={geometry.stepRadius}
          avatarCenterX={geometry.avatarCenterX}
          avatarCenterY={geometry.avatarCenterY}
          cradleRadius={geometry.cradleRadius}
          plateauRadius={geometry.plateauRadius}
          onEditPress={() => setCoverEditorOpen(true)}
          previewUri={coverDraft ? coverDraft.uri : undefined}
          previewKind={coverDraft?.kind}
          scrollY={scrollY}
          onPhotoUri={uri => {
            setCoverDraft({uri, kind: 'photo'})
            const coverUri = canonicalProfileMediaUri(uri, profile.coverUri)
            if (coverUri === undefined) return
            void updateProfile.mutateAsync({coverUri})
          }}
          onPhotoRemove={() => {
            setCoverDraft({uri: null, kind: 'none'})
            if (!profile.coverUri) return
            void updateProfile.mutateAsync({coverUri: null})
          }}
        />
        <View
          pointerEvents="box-none"
          style={[
            styles.avatarSlot,
            {
              left: geometry.avatarLeft,
              bottom: geometry.shelfDepth,
              height: geometry.slotSize,
              width: geometry.slotSize,
            },
          ]}>
          {avatar}
        </View>
      </View>
      {stacked ? (
        <View
          style={[
            styles.body,
            {
              paddingHorizontal: spacing[4],
              paddingTop: spacing[3],
              paddingBottom: spacing[2],
              gap: spacing[3],
            },
          ]}>
          {identity}
          {info}
          {stats}
        </View>
      ) : (
        <View
          pointerEvents="box-none"
          style={[
            styles.body,
            {
              marginTop: -geometry.plateauDepth,
              paddingHorizontal: spacing[4],
              paddingTop: geometry.identityPlateauGap,
              paddingBottom: spacing[2],
            },
          ]}>
          <View pointerEvents="box-none" style={styles.plateauRow}>
            <View
              pointerEvents="box-none"
              style={[
                styles.metricColumn,
                {
                  width: geometry.metricColumnWidth,
                  paddingTop: geometry.metricColumnTop,
                },
              ]}>
              {stats}
            </View>
            <View
              style={[
                styles.identityColumn,
                {
                  gap: spacing[2],
                  paddingLeft: geometry.identityColumnPad,
                  paddingTop: geometry.identityPlateauGap + geometry.identityDrop,
                },
              ]}>
              {identity}
              {info}
            </View>
          </View>
        </View>
      )}

      {canEdit ? (
        <>
          <ProfileCoverEditor
            visible={coverEditorOpen}
            initial={{
              uri: coverDraft?.uri ?? profile.coverUri ?? null,
              kind: coverDraft?.kind ?? (profile.coverUri ? 'photo' : 'gradient'),
            }}
            onClose={() => setCoverEditorOpen(false)}
            onSave={draft => {
              setCoverDraft(draft)
              const coverUri =
                draft.kind === 'none'
                  ? null
                  : canonicalProfileMediaUri(draft.uri, profile.coverUri)
              if (coverUri === undefined) return
              void updateProfile.mutateAsync({
                coverUri,
              })
            }}
          />
          <ProfileAvatarEditor
            visible={avatarEditorOpen}
            initial={{
              uri: avatarDraft?.uri ?? profile.avatarUri ?? null,
              sourceUri: avatarDraft?.sourceUri ?? profile.avatarUri ?? null,
            }}
            onClose={() => setAvatarEditorOpen(false)}
            onSave={draft => {
              setAvatarDraft(draft)
              const avatarUri = canonicalProfileMediaUri(draft.uri, profile.avatarUri)
              if (avatarUri === undefined) return
              void updateProfile.mutateAsync({
                avatarUri,
              })
            }}
          />
        </>
      ) : null}
    </View>
  )
}

function canonicalProfileMediaUri(next: string | null, previous?: string): string | null | undefined {
  if (next === null) return previous ? null : undefined
  if (!next || next === previous) return undefined
  return isPublicHttpsMediaUri(next) ? next : undefined
}

function isPublicHttpsMediaUri(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:'
  } catch {
    return false
  }
}

function HeroViewingCopy({viewer}: {viewer: ProfileViewerContext}) {
  if (viewer.mode !== 'preview') return null
  return (
    <AppText variant="caption" colour="textTertiary">
      Visitor preview — owner controls stay hidden.
    </AppText>
  )
}

const styles = StyleSheet.create({
  avatarSlot: {
    bottom: 0,
    position: 'absolute',
    zIndex: 3,
  },
  body: {
    minWidth: 0,
    zIndex: 2,
  },
  coverBlock: {
    overflow: 'visible',
    position: 'relative',
    zIndex: 1,
  },
  identityColumn: {
    flex: 1,
    minWidth: 0,
  },
  infoColumn: {
    minWidth: 0,
  },
  metricColumn: {
    flexGrow: 0,
    flexShrink: 0,
  },
  plateauRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    minWidth: 0,
  },
  visitorActions: {
    alignItems: 'flex-start',
    flexShrink: 0,
    minHeight: 44,
  },
  wrap: {
    overflow: 'visible',
    position: 'relative',
  },
})
