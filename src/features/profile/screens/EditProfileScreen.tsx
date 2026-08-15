import {useMemo, useState} from 'react'
import {Alert, ScrollView, StyleSheet, TextInput, View} from 'react-native'
import {useRouter} from 'expo-router'

import {AppIcon} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import {InitialLoadingState, QueryErrorState} from '@/components/data'
import {FOCUS_STATUS_OPTIONS, type FocusStatus} from '@/features/profile/contracts/presence'
import type {ModulaProfile, ProfileLink} from '@/features/profile/contracts/profile'
import {useOwnerProfileQuery, useUpdateProfileMutation} from '@/features/profile/data-query'
import {
  normaliseHandle,
  normaliseWebsite,
  validateBio,
  validateDisplayName,
  validateHandle,
  validateWebsite,
} from '@/features/profile/utils/validators'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {
  KeyboardSafeScreen,
  captureMediaFromSource,
  keyboardScrollProps,
  presentMediaSourceMenu,
  type MediaCaptureTarget,
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
  const {colours, radius, spacing} = useThemeTokens()
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

  const applyCapturedUri = (target: MediaCaptureTarget, uri: string) => {
    updateDraft(prev => ({
      ...prev,
      [target === 'avatar' ? 'avatarUri' : 'coverUri']: uri,
    }))
  }

  const pickImage = async (target: 'avatar' | 'cover', source: 'library' | 'camera') => {
    const result = await captureMediaFromSource(source, {target})
    if (result.ok) {
      applyCapturedUri(target, result.asset.uri)
      return
    }
    if (result.reason === 'cancelled') return
    Alert.alert(
      source === 'camera' ? 'Camera unavailable' : 'Photo unavailable',
      result.message,
    )
  }

  const openPhotoMenu = async (target: 'avatar' | 'cover') => {
    const result = await presentMediaSourceMenu({
      target,
      title: target === 'avatar' ? 'Profile photo' : 'Cover photo',
      message: 'Choose Photo or Take Photo. Changes stay in this local session.',
      includeRemove: Boolean(target === 'avatar' ? draft.avatarUri : draft.coverUri),
      removeLabel: target === 'avatar' ? 'Remove profile picture' : 'Remove cover image',
    })

    if (result.ok) {
      applyCapturedUri(target, result.asset.uri)
      return
    }
    if (result.reason === 'removed') {
      updateDraft(prev => ({
        ...prev,
        [target === 'avatar' ? 'avatarUri' : 'coverUri']: null,
      }))
      return
    }
    if (result.reason === 'dismissed' || result.reason === 'cancelled') return
    Alert.alert('Photo unavailable', result.message)
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
          contentContainerStyle={[styles.content, {gap: spacing[4], padding: spacing[4]}]}>
          <View style={styles.header}>
            <HeaderButton label="Cancel" onPress={leave} />
            <AppText variant="headline" style={styles.headerTitle}>
              Edit Profile
            </AppText>
            <HeaderButton label="Save" onPress={() => void save()} primary />
          </View>
          <Surface
            variant="contained"
            style={[styles.notice, {gap: spacing[2], padding: spacing[3]}]}>
            <AppIcon name="info" colour={colours.accent} />
            <AppText variant="caption" colour="textSecondary" style={styles.noticeText}>
              Profile details save to Greenfield and follow the audience for each field.
            </AppText>
          </Surface>

          <ImageControls
            title="Avatar"
            changeLabel="Change profile picture"
            onChoose={() => void openPhotoMenu('avatar')}
            onCamera={() => void pickImage('avatar', 'camera')}
          />
          <ImageControls
            title="Cover"
            changeLabel="Change cover image"
            onChoose={() => void openPhotoMenu('cover')}
            onCamera={() => void pickImage('cover', 'camera')}
          />

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
          />
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
          />

          <View style={{gap: spacing[2]}}>
            <AppText variant="headline">Focus status</AppText>
            <View style={[styles.statusGrid, {gap: spacing[2]}]}>
              {FOCUS_STATUS_OPTIONS.map(status => {
                const selected = draft.focusStatus.id === status.id
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
                      styles.statusButton,
                      {
                        backgroundColor: selected ? colours.accentSubtle : colours.surfaceRaised,
                        borderColor: selected ? colours.accentBorder : colours.border,
                        borderRadius: radius.round,
                        paddingHorizontal: spacing[3],
                      },
                    ]}>
                    <AppText
                      variant="label"
                      style={{color: selected ? colours.accent : colours.text}}>
                      {status.label}
                    </AppText>
                  </AppPressable>
                )
              })}
            </View>
          </View>
        </ScrollView>
      </ResponsiveContent>
    </KeyboardSafeScreen>
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

function ImageControls({
  title,
  changeLabel,
  onChoose,
  onCamera,
}: {
  title: string
  changeLabel: string
  onChoose: () => void
  onCamera: () => void
}) {
  const {spacing} = useThemeTokens()
  return (
    <Surface variant="contained" style={[styles.imageControls, {gap: spacing[3], padding: spacing[3]}]}>
      <AppText variant="headline">{title}</AppText>
      <AppText variant="caption" colour="textSecondary">
        {changeLabel}. Local session only — not uploaded.
      </AppText>
      <View style={[styles.controlRow, {gap: spacing[2]}]}>
        <ControlButton
          label="Choose Photo"
          icon="photo"
          onPress={onChoose}
          accessibilityLabel={`${changeLabel}. Opens Choose Photo, Take Photo, or Remove`}
        />
        <ControlButton
          label="Take Photo"
          icon="camera"
          onPress={onCamera}
          accessibilityLabel={`Take Photo for ${title.toLowerCase()}`}
        />
      </View>
    </Surface>
  )
}

function ControlButton({
  label,
  icon,
  onPress,
  accessibilityLabel,
}: {
  label: string
  icon: Parameters<typeof AppIcon>[0]['name']
  onPress: () => void
  accessibilityLabel?: string
}) {
  const {colours, radius, spacing} = useThemeTokens()
  return (
    <AppPressable
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      style={[
        styles.controlButton,
        {
          backgroundColor: colours.surfaceRaised,
          borderColor: colours.border,
          borderRadius: radius.round,
          gap: spacing[2],
          paddingHorizontal: spacing[3],
        },
      ]}>
      <AppIcon name={icon} colour={colours.accent} size={18} />
      <AppText variant="label">{label}</AppText>
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
}) {
  const {colours, radius, spacing} = useThemeTokens()
  return (
    <View style={{gap: spacing[2]}}>
      <AppText variant="headline">{label}</AppText>
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        maxLength={maxLength}
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
        placeholderTextColor={colours.textTertiary}
        style={[
          styles.input,
          multiline ? styles.multiline : null,
          {
            backgroundColor: colours.surfaceRaised,
            borderColor: colours.border,
            borderRadius: radius.medium,
            color: colours.text,
            padding: spacing[3],
          },
        ]}
      />
      {help ? (
        <AppText variant="caption" colour="textSecondary">
          {help}
        </AppText>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 48,
  },
  controlButton: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'center',
    minHeight: 44,
  },
  controlRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
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
  imageControls: {
    minWidth: 0,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 48,
  },
  multiline: {
    minHeight: 104,
    textAlignVertical: 'top',
  },
  notice: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  noticeText: {
    flex: 1,
  },
  screen: {
    flex: 1,
  },
  statusButton: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
})
