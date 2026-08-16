import {useMemo, useState, type ReactNode} from 'react'
import {Alert, ScrollView, StyleSheet, View} from 'react-native'
import {Image} from 'expo-image'
import {useRouter} from 'expo-router'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {Avatar} from '@/components/primitives/Avatar'
import {InitialLoadingState, QueryErrorState} from '@/components/data'
import {FOCUS_STATUS_OPTIONS, type FocusStatus} from '@/features/profile/contracts/presence'
import type {ModulaProfile, ProfileLink} from '@/features/profile/contracts/profile'
import {useOwnerProfileQuery, useUpdateProfileMutation} from '@/features/profile/data-query'
import {
  applyProfilePhotoMenuAction,
  profilePhotoMenuActions,
} from '@/features/profile/components/profile-photo-menu'
import {
  normaliseHandle,
  normaliseWebsite,
  validateBio,
  validateDisplayName,
  validateHandle,
  validateWebsite,
} from '@/features/profile/utils/validators'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {CoverAtmosphere} from '@/platform/ui/atmosphere/cover-atmosphere'
import {
  KeyboardSafeScreen,
  ModulaContextMenu,
  ModulaFieldShell,
  ModulaIcon,
  ModulaTextInput,
  keyboardScrollProps,
} from '@/platform/ui'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type EditProfileDraft = {
  avatarUri: string | null
  coverUri: string | null
  displayName: string
  handle: string
  bio: string
  pronouns: string
  location: string
  website: string
  focusStatus: FocusStatus
}

function createDraft(profile?: ModulaProfile): EditProfileDraft {
  return {
    avatarUri: profile?.avatarUri ?? null,
    coverUri: profile?.coverUri ?? null,
    displayName: profile?.displayName ?? '',
    handle: profile?.handle ?? '',
    bio: profile?.bio ?? '',
    pronouns: profile?.pronouns ?? '',
    location: profile?.location?.label ?? '',
    website: profile?.website?.url ?? '',
    focusStatus: profile?.focusStatus ?? FOCUS_STATUS_OPTIONS[0],
  }
}

export function EditProfileScreen() {
  const router = useRouter()
  const ownerProfileQuery = useOwnerProfileQuery()
  const updateProfileMutation = useUpdateProfileMutation()
  const {colours, spacing} = useThemeTokens()
  const ownerProfile = ownerProfileQuery.data
  const [draftOverride, setDraft] = useState<EditProfileDraft | null>(null)
  const draft = draftOverride ?? createDraft(ownerProfile)
  const updateDraft = (updater: (draft: EditProfileDraft) => EditProfileDraft) => {
    setDraft(prev => updater(prev ?? createDraft(ownerProfile)))
  }

  const initial = useMemo(() => JSON.stringify({
    avatarUri: ownerProfile?.avatarUri ?? null,
    coverUri: ownerProfile?.coverUri ?? null,
    displayName: ownerProfile?.displayName ?? '',
    handle: ownerProfile?.handle ?? '',
    bio: ownerProfile?.bio ?? '',
    pronouns: ownerProfile?.pronouns ?? '',
    location: ownerProfile?.location?.label ?? '',
    website: ownerProfile?.website?.url ?? '',
    focusStatus: ownerProfile?.focusStatus.id ?? '',
  }), [ownerProfile])
  const current = JSON.stringify({
    ...draft,
    focusStatus: draft.focusStatus.id,
  })
  const dirty = current !== initial

  const leave = () => {
    if (!dirty) {
      router.back()
      return
    }
    Alert.alert('Discard changes?', 'Your local profile edits have not been saved.', [
      {text: 'Keep editing', style: 'cancel'},
      {text: 'Discard', style: 'destructive', onPress: () => router.back()},
    ])
  }

  const save = async () => {
    if (!ownerProfile) return
    const displayNameResult = validateDisplayName(draft.displayName)
    const handleResult = validateHandle(draft.handle)
    const bioResult = validateBio(draft.bio)
    const websiteResult = validateWebsite(draft.website)
    const firstError = [displayNameResult, handleResult, bioResult, websiteResult].find(
      result => !result.valid,
    )
    if (firstError && !firstError.valid) {
      Alert.alert('Check profile details', firstError.message)
      return
    }

    const website = createWebsiteLink(draft.website)
    await updateProfileMutation.mutateAsync({
      avatarUri: canonicalProfileMediaUri(draft.avatarUri, ownerProfile.avatarUri),
      coverUri: canonicalProfileMediaUri(draft.coverUri, ownerProfile.coverUri),
      displayName: draft.displayName.trim(),
      handle: normaliseHandle(draft.handle),
      bio: draft.bio.trim(),
      pronouns: draft.pronouns.trim() || undefined,
      location: draft.location.trim()
        ? {
            label: draft.location.trim(),
            visibility: ownerProfile.location?.visibility ?? 'public',
          }
        : null,
      website,
      focusStatus: draft.focusStatus,
    })
    router.replace('/profile')
  }

  const applyCapturedUri = (target: 'avatar' | 'cover', uri: string) => {
    updateDraft(prev => ({
      ...prev,
      [target === 'avatar' ? 'avatarUri' : 'coverUri']: uri,
    }))
  }

  if (ownerProfileQuery.isLoading || !ownerProfile) {
    return <InitialLoadingState label="Loading profile editor" />
  }

  if (ownerProfileQuery.isError) {
    return (
      <QueryErrorState
        error={ownerProfileQuery.error}
        onRetry={() => void ownerProfileQuery.refetch()}
      />
    )
  }

  return (
    <KeyboardSafeScreen style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <ResponsiveContent maxWidth={760}>
        <ScrollView
          {...keyboardScrollProps}
          contentContainerStyle={[styles.content, {gap: spacing[5], padding: spacing[4]}]}>
          <View style={styles.header}>
            <HeaderButton label="Cancel" onPress={leave} />
            <AppText variant="headline" style={styles.headerTitle}>
              Edit Profile
            </AppText>
            <HeaderButton label="Save" onPress={() => void save()} primary />
          </View>
          <AppText variant="caption" colour="textTertiary">
            Long-press the cover or photo to change it. Details save to Greenfield.
          </AppText>

          <EditProfilePreview
            draft={draft}
            onPhotoUri={applyCapturedUri}
            onPhotoRemove={target =>
              updateDraft(prev => ({
                ...prev,
                [target === 'avatar' ? 'avatarUri' : 'coverUri']: null,
              }))
            }
          />

          <GroupedSection title="Identity">
            <ProfileField
              label="Display name"
              testID="edit-profile-display-name"
              value={draft.displayName}
              onChangeText={value => updateDraft(prev => ({...prev, displayName: value}))}
              maxLength={50}
            />
            <ProfileField
              label="Handle"
              testID="edit-profile-handle"
              value={draft.handle}
              onChangeText={value => updateDraft(prev => ({...prev, handle: normaliseHandle(value)}))}
              autoCapitalize="none"
              maxLength={30}
              help="Handle availability is checked when you save."
            />
            <ProfileField
              label="Biography"
              testID="edit-profile-bio"
              value={draft.bio}
              onChangeText={value => updateDraft(prev => ({...prev, bio: value}))}
              multiline
              maxLength={160}
              help={`${draft.bio.length}/160`}
            />
            <ProfileField
              label="Pronouns"
              testID="edit-profile-pronouns"
              value={draft.pronouns}
              onChangeText={value => updateDraft(prev => ({...prev, pronouns: value}))}
              last
            />
          </GroupedSection>

          <GroupedSection title="Links">
            <ProfileField
              label="Location"
              testID="edit-profile-location"
              value={draft.location}
              onChangeText={value => updateDraft(prev => ({...prev, location: value}))}
            />
            <ProfileField
              label="Website"
              testID="edit-profile-website"
              value={draft.website}
              onChangeText={value => updateDraft(prev => ({...prev, website: value}))}
              autoCapitalize="none"
              keyboardType="url"
              help="Use http:// or https://. Missing schemes are saved as https://."
              last
            />
          </GroupedSection>

          <GroupedSection title="Focus">
            {FOCUS_STATUS_OPTIONS.map((status, index) => {
              const selected = draft.focusStatus.id === status.id
              const last = index === FOCUS_STATUS_OPTIONS.length - 1
              return (
                <AppPressable
                  key={status.id}
                  accessibilityLabel={`Set focus status to ${status.label}`}
                  accessibilityState={{selected}}
                  onPress={() =>
                    updateDraft(prev => ({
                      ...prev,
                      focusStatus: {
                        ...status,
                        updatedAt: new Date().toISOString(),
                      },
                    }))
                  }
                  style={[
                    styles.statusRow,
                    {
                      borderBottomColor: last ? 'transparent' : colours.separator,
                      paddingHorizontal: spacing[4],
                      paddingVertical: spacing[3],
                    },
                  ]}>
                  <View style={styles.statusCopy}>
                    <AppText variant="body">{status.label}</AppText>
                    {status.message ? (
                      <AppText variant="caption" colour="textTertiary">
                        {status.message}
                      </AppText>
                    ) : null}
                  </View>
                  {selected ? (
                    <ModulaIcon name="check" colour={colours.accent} size={18} />
                  ) : null}
                </AppPressable>
              )
            })}
          </GroupedSection>
        </ScrollView>
      </ResponsiveContent>
    </KeyboardSafeScreen>
  )
}

function EditProfilePreview({
  draft,
  onPhotoUri,
  onPhotoRemove,
}: {
  draft: EditProfileDraft
  onPhotoUri: (target: 'avatar' | 'cover', uri: string) => void
  onPhotoRemove: (target: 'avatar' | 'cover') => void
}) {
  const {colours, spacing} = useThemeTokens()
  const avatarSize = 88

  return (
    <View>
      <ModulaContextMenu
        fit="fill"
        accessibilityLabel="Cover photo actions"
        title="Cover photo"
        actions={profilePhotoMenuActions({
          hasPhoto: Boolean(draft.coverUri),
          removeLabel: 'Remove cover image',
        })}
        onAction={id => {
          void applyProfilePhotoMenuAction({
            actionId: id,
            target: 'cover',
            onUri: uri => onPhotoUri('cover', uri),
            onRemove: () => onPhotoRemove('cover'),
          })
        }}>
        <View
          style={[
            styles.previewCover,
            {backgroundColor: colours.surfaceRaised, borderRadius: 18},
          ]}>
          {draft.coverUri ? (
            <Image
              source={{uri: draft.coverUri}}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
            />
          ) : (
            <CoverAtmosphere wash={colours.surfaceRaised} ink={colours.text} paper={colours.surface} />
          )}
        </View>
      </ModulaContextMenu>
      <View
        style={[
          styles.previewIdentity,
          {
            backgroundColor: colours.canvas,
            marginTop: -20,
            paddingHorizontal: spacing[1],
          },
        ]}>
        <View style={{marginTop: -(avatarSize / 2), alignSelf: 'flex-start', zIndex: 2}}>
          <ModulaContextMenu
            fit="content"
            accessibilityLabel="Profile photo actions"
            title="Profile photo"
            actions={profilePhotoMenuActions({
              hasPhoto: Boolean(draft.avatarUri),
              removeLabel: 'Remove profile picture',
            })}
            onAction={id => {
              void applyProfilePhotoMenuAction({
                actionId: id,
                target: 'avatar',
                onUri: uri => onPhotoUri('avatar', uri),
                onRemove: () => onPhotoRemove('avatar'),
              })
            }}>
            <Avatar
              name={draft.displayName || 'Profile'}
              uri={draft.avatarUri ?? undefined}
              size={avatarSize}
              style={{borderColor: colours.canvas, borderWidth: 4}}
            />
          </ModulaContextMenu>
        </View>
        <AppText variant="headline" numberOfLines={1}>
          {draft.displayName || 'Display name'}
        </AppText>
        <AppText variant="caption" colour="textSecondary">
          @{draft.handle || 'handle'}
        </AppText>
      </View>
    </View>
  )
}

function GroupedSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  const {colours, radius, spacing} = useThemeTokens()
  return (
    <View style={{gap: spacing[2]}}>
      <AppText
        variant="caption"
        colour="textTertiary"
        style={{letterSpacing: 0.6, paddingHorizontal: spacing[4], textTransform: 'uppercase'}}>
        {title}
      </AppText>
      <View
        style={[
          styles.group,
          {
            backgroundColor: colours.surface,
            borderColor: colours.separator,
            borderRadius: radius.large,
          },
        ]}>
        {children}
      </View>
    </View>
  )
}

function createWebsiteLink(value: string): ProfileLink | null {
  const normalised = normaliseWebsite(value)
  if (!normalised) return null
  const url = new URL(normalised)
  return {
    id: 'link-owner-website',
    label: 'Website',
    url: url.toString(),
    domain: url.hostname,
    visibility: 'public',
  }
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

function HeaderButton({
  label,
  onPress,
  primary,
}: {
  label: string
  onPress: () => void
  primary?: boolean
}) {
  const {colours, radius, spacing} = useThemeTokens()
  return (
    <AppPressable
      accessibilityLabel={label}
      onPress={onPress}
      style={[
        styles.headerButton,
        {
          backgroundColor: primary ? colours.accent : colours.surfaceRaised,
          borderColor: primary ? 'transparent' : colours.border,
          borderRadius: radius.round,
          paddingHorizontal: spacing[3],
        },
      ]}>
      <AppText
        variant="label"
        style={{color: primary ? colours.accentForeground : colours.text}}>
        {label}
      </AppText>
    </AppPressable>
  )
}

function ProfileField({
  label,
  testID,
  value,
  onChangeText,
  help,
  multiline,
  maxLength,
  autoCapitalize,
  keyboardType,
  last,
}: {
  label: string
  testID?: string
  value: string
  onChangeText: (value: string) => void
  help?: string
  multiline?: boolean
  maxLength?: number
  autoCapitalize?: 'none'
  keyboardType?: 'url'
  last?: boolean
}) {
  const {colours, spacing} = useThemeTokens()
  return (
    <View
      style={[
        styles.field,
        {
          borderBottomColor: last ? 'transparent' : colours.separator,
          paddingHorizontal: spacing[4],
          paddingVertical: spacing[3],
        },
      ]}>
      <ModulaFieldShell label={label} support={help}>
        <ModulaTextInput
          testID={testID}
          value={value}
          onChangeText={onChangeText}
          multiline={multiline}
          maxLength={maxLength}
          autoCapitalize={autoCapitalize}
          keyboardType={keyboardType}
          accessibilityLabel={label}
          style={styles.flatField}
        />
      </ModulaFieldShell>
    </View>
  )
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 48,
  },
  field: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  flatField: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    paddingHorizontal: 0,
  },
  group: {
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  headerButton: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
  },
  previewCover: {
    height: 140,
    overflow: 'hidden',
    width: '100%',
  },
  previewIdentity: {
    gap: 4,
  },
  screen: {
    flex: 1,
  },
  statusCopy: {
    flex: 1,
    gap: 2,
  },
  statusRow: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
  },
})
