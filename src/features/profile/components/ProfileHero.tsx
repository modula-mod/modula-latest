import {useState} from 'react'
import {StyleSheet, View, useWindowDimensions} from 'react-native'

import type {
  ModulaProfile,
  ProfilePresentationPreferences,
  ProfileViewerContext,
} from '@/features/profile/contracts/profile'
import {AppText} from '@/components/primitives/AppText'
import {useUpdateProfileMutation} from '@/features/profile/data-query'
import {ProfileActions} from '@/features/profile/components/ProfileActions'
import {ProfileAboutPage} from '@/features/profile/components/ProfileAboutPage'
import {ProfileAvatar} from '@/features/profile/components/ProfileAvatar'
import {ProfileCover} from '@/features/profile/components/ProfileCover'
import {ProfileIdentity} from '@/features/profile/components/ProfileIdentity'
import {ProfileInfoPager} from '@/features/profile/components/ProfileInfoPager'
import {ProfileMetricsPage} from '@/features/profile/components/ProfileMetricsPage'
import {
  ProfileAvatarEditor,
  type ProfileAvatarDraft,
} from '@/features/profile/editor/profile-avatar-editor'
import {
  ProfileCoverEditor,
  type ProfileCoverDraft,
} from '@/features/profile/editor/profile-cover-editor'
import {profileGeometry} from '@/features/profile/model/profile-layout'
import {InvertedSurfaceTransition} from '@/platform/ui/geometry'
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
 * Cover is full-bleed from the status bar. Cover photos stay `expo-image` —
 * `@expo/ui` Image is SF Symbols only (Expo SDK 57 docs).
 *
 * The inverted SVG cradle is painted in this body overlap band so the
 * portrait and the pocket share `profilePocketGeometry()`.
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
  const pocket = geometry.pocket

  const [coverEditorOpen, setCoverEditorOpen] = useState(false)
  const [avatarEditorOpen, setAvatarEditorOpen] = useState(false)
  const [coverDraft, setCoverDraft] = useState<ProfileCoverDraft | null>(null)
  const [avatarDraft, setAvatarDraft] = useState<ProfileAvatarDraft | null>(null)

  const identity = (
    <ProfileIdentity profile={profile} viewer={viewer} compact emphasis="hero" />
  )
  const pager = (
    <ProfileInfoPager
      metrics={
        showStats ? (
          <ProfileMetricsPage
            profile={profile}
            ownerHandle={ownerHandle}
            presentation={presentation}
            onSelectTab={onSelectTab}
            isOwner={viewer.canEdit}
          />
        ) : null
      }
      about={<ProfileAboutPage profile={profile} viewer={viewer} />}
    />
  )
  const extras = (
    <>
      {showActions && !viewer.canEdit ? (
        <View style={styles.visitorActions}>
          <ProfileActions profile={profile} viewer={viewer} />
        </View>
      ) : null}
      <HeroViewingCopy viewer={viewer} />
    </>
  )

  const avatar = (
    <View
      collapsable={false}
      pointerEvents="box-none"
      style={[
        styles.avatarFlow,
        {
          marginTop: geometry.avatarFlowTop,
          marginLeft: geometry.avatarFlowLeft,
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
  )

  const cradle = (
    <View pointerEvents="none" style={styles.cradle}>
      <InvertedSurfaceTransition
        edge="top"
        side="leading"
        size="md"
        width={width}
        height={geometry.plateauDepth}
        fill={colours.canvas}
        cornerRadius={geometry.plateauRadius}
        avatarCenterX={pocket.avatarCenterX}
        avatarCenterY={pocket.avatarCenterY}
        cradleRadius={pocket.pocketRadius}
        plateauRadius={geometry.plateauRadius}
        stepX={geometry.stepX}
        stepRise={geometry.stepRise}
        stepRadius={geometry.stepRadius}
      />
    </View>
  )

  return (
    <View collapsable={false} style={styles.wrap}>
      <View collapsable={false} style={styles.coverBlock}>
        <ProfileCover
          profile={profile}
          compact={isCompact}
          canEdit={canEdit}
          onEditPress={() => setCoverEditorOpen(true)}
          previewUri={coverDraft ? coverDraft.uri : undefined}
          previewKind={coverDraft?.kind}
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
      </View>
      <View
        pointerEvents="box-none"
        style={[
          styles.body,
          {
            marginTop: -geometry.plateauDepth,
            paddingBottom: spacing[2],
          },
        ]}>
        <View
          pointerEvents="none"
          style={[
            styles.canvasFill,
            {backgroundColor: colours.canvas, top: geometry.plateauDepth},
          ]}
        />
        {cradle}
        {stacked ? (
          <View
            pointerEvents="box-none"
            style={[
              styles.stacked,
              {
                paddingHorizontal: spacing[4],
                paddingTop: geometry.identityPlateauGap,
                gap: spacing[3],
              },
            ]}>
            {avatar}
            {identity}
            {extras}
            {pager}
          </View>
        ) : (
          <View
            pointerEvents="box-none"
            style={[
              styles.content,
              {
                paddingHorizontal: spacing[4],
                paddingTop: geometry.identityPlateauGap,
                gap: geometry.metricColumnTop,
              },
            ]}>
            <View pointerEvents="box-none" style={styles.plateauRow}>
              <View
                pointerEvents="box-none"
                style={[
                  styles.avatarColumn,
                  {
                    width: geometry.metricColumnWidth,
                  },
                ]}>
                {avatar}
              </View>
              <View
                style={[
                  styles.identityColumn,
                  {
                    gap: spacing[1],
                    paddingLeft: geometry.identityColumnPad,
                    paddingTop: geometry.identityDrop,
                  },
                ]}>
                {identity}
                {extras}
              </View>
            </View>
            {pager}
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
  if (viewer.mode !== 'preview') return null
  return (
    <AppText variant="caption" colour="textTertiary">
      Visitor preview — owner controls stay hidden.
    </AppText>
  )
}

const styles = StyleSheet.create({
  avatarColumn: {
    flexGrow: 0,
    flexShrink: 0,
    overflow: 'visible',
  },
  avatarFlow: {
    overflow: 'visible',
    zIndex: 3,
  },
  body: {
    minWidth: 0,
    overflow: 'visible',
    position: 'relative',
    zIndex: 2,
  },
  canvasFill: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    zIndex: 0,
  },
  content: {
    minWidth: 0,
    overflow: 'visible',
    zIndex: 2,
  },
  coverBlock: {
    overflow: 'visible',
    position: 'relative',
    zIndex: 1,
  },
  cradle: {
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 1,
  },
  identityColumn: {
    flex: 1,
    minWidth: 0,
    zIndex: 2,
  },
  plateauRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    minWidth: 0,
    zIndex: 2,
  },
  stacked: {
    minWidth: 0,
    overflow: 'visible',
    zIndex: 2,
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
