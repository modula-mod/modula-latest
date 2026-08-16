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
 * Avatar occupies the leading inverted valley; identity sits on the raised
 * trailing plateau; metrics and metadata share a compact lower row.
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
  const isCompact = compact ?? width < 760
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
    <ProfileIdentity profile={profile} viewer={viewer} compact />
  )
  const info = (
    <View style={[styles.infoColumn, {gap: spacing[2]}]}>
      {showActions && !viewer.canEdit ? (
        <View style={styles.visitorActions}>
          <ProfileActions profile={profile} viewer={viewer} />
        </View>
      ) : null}
      <HeroViewingCopy viewer={viewer} />
      <ProfileBio profile={profile} compact />
      <ProfileMetadataGrid profile={profile} viewer={viewer} />
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

  return (
    <View style={[styles.wrap, {backgroundColor: colours.canvas}]}>
      <ProfileCover
        profile={profile}
        compact={isCompact}
        canEdit={canEdit}
        slotSize={geometry.slotSize}
        contentInset={geometry.heroHorizontalInset}
        raisedBodyHeight={geometry.raisedBodyHeight}
        avatarCenterX={geometry.avatarCenterX}
        cradleRadius={geometry.cradleRadius}
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
            left: geometry.heroHorizontalInset,
            top: geometry.coverBody - geometry.avatarOverlap,
            height: geometry.slotSize,
            width: geometry.slotSize,
          },
        ]}>
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
      </View>
      <View
        style={[
          styles.body,
          {
            paddingHorizontal: spacing[4],
            paddingTop: 0,
            paddingBottom: spacing[2],
            gap: spacing[2],
          },
        ]}>
        <View
          style={{
            marginTop: stacked ? 0 : -geometry.raisedIdentityInset,
            minHeight: stacked
              ? geometry.identityPaddingTop
              : geometry.raisedIdentityInset,
            paddingLeft: stacked ? 0 : geometry.identityColumnOffset,
            paddingTop: stacked ? geometry.identityPaddingTop : spacing[2],
            justifyContent: 'flex-end',
          }}>
          {identity}
        </View>
        {stacked ? (
          <View style={{gap: spacing[3]}}>
            {info}
            {stats}
          </View>
        ) : (
          <View style={[styles.lowerGrid, {gap: spacing[3]}]}>
            <View style={styles.infoSlot}>{info}</View>
            <View
              style={[
                styles.metricColumn,
                {
                  width: geometry.metricColumnWidth,
                  minWidth: geometry.metricColumnWidth,
                  paddingTop: geometry.avatarOverlap,
                },
              ]}>
              {stats}
            </View>
          </View>
        )}
      </View>

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
  if (viewer.canEdit) return null
  const copy =
    viewer.mode === 'preview'
      ? 'Visitor preview — owner controls stay hidden.'
      : viewer.relationship === 'visitor'
        ? 'You’re viewing the public profile.'
        : 'You’re viewing this profile with your current access.'
  return (
    <AppText variant="caption" colour="textTertiary">
      {copy}
    </AppText>
  )
}

const styles = StyleSheet.create({
  avatarSlot: {
    position: 'absolute',
    zIndex: 3,
  },
  body: {
    minWidth: 0,
    zIndex: 2,
  },
  infoColumn: {
    minWidth: 0,
  },
  infoSlot: {
    flex: 1,
    minWidth: 0,
  },
  lowerGrid: {
    alignItems: 'flex-start',
    flexDirection: 'row-reverse',
    minWidth: 0,
  },
  metricColumn: {
    flexGrow: 0,
    flexShrink: 0,
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
