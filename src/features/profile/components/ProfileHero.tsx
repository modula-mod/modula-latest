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
import {ProfileIdentity} from '@/features/profile/components/ProfileIdentity'
import {ProfileStats} from '@/features/profile/components/ProfileStats'
import {
  ProfileAvatarEditor,
  type ProfileAvatarDraft,
} from '@/features/profile/editor/profile-avatar-editor'
import {
  ProfileCoverEditor,
  type ProfileCoverDraft,
} from '@/features/profile/editor/profile-cover-editor'
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
 * X / Instagram / Bluesky / LinkedIn: cover is full-bleed from the top
 * (under the transparent header) → avatar overlapping the banner → identity
 * and inline stats on the canvas. Edit lives on the avatar row.
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
  const {width} = useWindowDimensions()
  const {colours, spacing} = useThemeTokens()
  const updateProfile = useUpdateProfileMutation()
  const isCompact = compact ?? width < 760
  const avatarSize = isCompact ? 92 : 116
  const canEdit = viewer.canEdit

  const [coverEditorOpen, setCoverEditorOpen] = useState(false)
  const [avatarEditorOpen, setAvatarEditorOpen] = useState(false)
  const [coverDraft, setCoverDraft] = useState<ProfileCoverDraft | null>(null)
  const [avatarDraft, setAvatarDraft] = useState<ProfileAvatarDraft | null>(null)

  return (
    <View style={[styles.wrap, {backgroundColor: colours.canvas}]}>
      <ProfileCover
        profile={profile}
        compact={isCompact}
        canEdit={canEdit}
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
        style={[
          styles.body,
          {
            paddingHorizontal: spacing[4],
            paddingBottom: spacing[3],
            gap: spacing[3],
          },
        ]}>
        <View style={styles.avatarRow}>
          <View style={{marginTop: -(avatarSize / 2), zIndex: 2}}>
            <ProfileAvatar
              profile={profile}
              size={avatarSize}
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
          {showActions ? (
            <View style={styles.avatarActions}>
              <ProfileActions profile={profile} viewer={viewer} />
            </View>
          ) : null}
        </View>
        <ProfileIdentity profile={profile} viewer={viewer} compact />
        <HeroViewingCopy viewer={viewer} />
        {showStats ? (
          <ProfileStats
            profile={profile}
            ownerHandle={ownerHandle}
            presentation={presentation}
            onSelectTab={onSelectTab}
          />
        ) : null}
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
  avatarActions: {
    flexShrink: 0,
    paddingBottom: 8,
  },
  avatarRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  body: {
    minWidth: 0,
  },
  wrap: {
    overflow: 'hidden',
  },
})
