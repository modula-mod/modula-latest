import {useState} from 'react'
import {StyleSheet, View, useWindowDimensions} from 'react-native'

import type {
  ModulaProfile,
  ProfilePresentationPreferences,
  ProfileViewerContext,
} from '@/features/profile/contracts/profile'
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
}

/**
 * Mobile order: cover → avatar overlap → identity → actions → stats.
 * Identity claims stay in About; cover/avatar editors open for owners only.
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
}: ProfileHeroProps) {
  const {width} = useWindowDimensions()
  const {colours, spacing} = useThemeTokens()
  const updateProfile = useUpdateProfileMutation()
  const isCompact = compact ?? width < 760
  const avatarSize = isCompact ? 96 : 120
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
      />
      <View
        style={[
          styles.body,
          {
            paddingHorizontal: spacing[4],
            paddingBottom: spacing[4],
            marginTop: -(avatarSize / 2),
            gap: spacing[3],
          },
        ]}>
        <ProfileAvatar
          profile={profile}
          size={avatarSize}
          showFocusHalo={presentation.showFocusHalo}
          canEdit={canEdit}
          onEditPress={() => setAvatarEditorOpen(true)}
          previewUri={avatarDraft ? avatarDraft.uri : undefined}
        />
        <ProfileIdentity profile={profile} viewer={viewer} compact={isCompact} />
      </View>
      {showActions ? (
        <View style={[styles.section, {paddingHorizontal: spacing[4], paddingBottom: spacing[3]}]}>
          <ProfileActions profile={profile} viewer={viewer} />
        </View>
      ) : null}
      {showStats ? (
        <ProfileStats
          profile={profile}
          ownerHandle={ownerHandle}
          presentation={presentation}
          onSelectTab={onSelectTab}
        />
      ) : null}

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
              void updateProfile.mutateAsync({
                coverUri: draft.kind === 'none' ? null : draft.uri,
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
              void updateProfile.mutateAsync({
                avatarUri: draft.uri,
              })
            }}
          />
        </>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  body: {
    alignItems: 'flex-start',
  },
  section: {
    minWidth: 0,
  },
  wrap: {
    overflow: 'hidden',
  },
})
