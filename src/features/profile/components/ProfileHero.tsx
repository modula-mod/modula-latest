import {useState} from 'react'
import {StyleSheet, View, useWindowDimensions} from 'react-native'
import type {SharedValue} from 'react-native-reanimated'

import type {
  ModulaProfile,
  ProfilePresentationPreferences,
  ProfileViewerContext,
} from '@/features/profile/contracts/profile'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
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
  scrollY,
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
        scrollY={scrollY}
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
        <HeroViewingCopy viewer={viewer} />
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

function HeroViewingCopy({viewer}: {viewer: ProfileViewerContext}) {
  const {colours, radius, spacing} = useThemeTokens()
  const copy = viewer.canEdit
    ? 'You are viewing owner controls. Visitors see only the published tabs, public fields, and module cards you choose to show.'
    : viewer.mode === 'preview'
      ? 'You are viewing the visitor preview. Owner-only controls, private modules, and unpublished fields are hidden.'
      : viewer.relationship === 'visitor'
        ? 'You are viewing this profile as a visitor. Private fields, owner controls, and unavailable module tabs are hidden.'
        : 'You are viewing this profile with your current audience access. Private owner controls remain hidden.'

  return (
    <Surface
      variant="contained"
      style={[
        styles.viewingCopy,
        {
          backgroundColor: colours.surface,
          borderColor: colours.border,
          borderRadius: radius.medium,
          padding: spacing[3],
        },
      ]}>
      <AppText variant="body" colour="textSecondary">
        {copy}
      </AppText>
    </Surface>
  )
}

const styles = StyleSheet.create({
  body: {
    alignItems: 'flex-start',
  },
  section: {
    minWidth: 0,
  },
  viewingCopy: {
    borderWidth: StyleSheet.hairlineWidth,
    width: '100%',
  },
  wrap: {
    overflow: 'hidden',
  },
})
