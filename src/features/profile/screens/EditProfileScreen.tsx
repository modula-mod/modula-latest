import {useMemo, useState} from 'react'
import {Alert, ScrollView, StyleSheet, TextInput, View} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import {useRouter} from 'expo-router'

import {AppIcon} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import {FOCUS_STATUS_OPTIONS, type FocusStatus} from '@/features/profile/contracts/presence'
import type {ProfileLink} from '@/features/profile/contracts/profile'
import {useProfile} from '@/features/profile/runtime/useProfile'
import {useProfileActions} from '@/features/profile/runtime/useProfileActions'
import {
  normaliseHandle,
  normaliseWebsite,
  validateBio,
  validateDisplayName,
  validateHandle,
  validateWebsite,
} from '@/features/profile/utils/validators'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
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

export function EditProfileScreen() {
  const router = useRouter()
  const {ownerProfile} = useProfile()
  const {setOwnerAvatar, setOwnerCover, updateOwnerProfile} = useProfileActions()
  const {colours, radius, spacing} = useThemeTokens()
  const [draft, setDraft] = useState<EditProfileDraft>(() => ({
    avatarUri: ownerProfile.avatarUri ?? null,
    coverUri: ownerProfile.coverUri ?? null,
    displayName: ownerProfile.displayName,
    handle: ownerProfile.handle,
    bio: ownerProfile.bio,
    pronouns: ownerProfile.pronouns ?? '',
    location: ownerProfile.location?.label ?? '',
    website: ownerProfile.website?.url ?? '',
    focusStatus: ownerProfile.focusStatus,
  }))

  const initial = useMemo(() => JSON.stringify({
    avatarUri: ownerProfile.avatarUri ?? null,
    coverUri: ownerProfile.coverUri ?? null,
    displayName: ownerProfile.displayName,
    handle: ownerProfile.handle,
    bio: ownerProfile.bio,
    pronouns: ownerProfile.pronouns ?? '',
    location: ownerProfile.location?.label ?? '',
    website: ownerProfile.website?.url ?? '',
    focusStatus: ownerProfile.focusStatus.id,
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

  const save = () => {
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
    updateOwnerProfile({
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
    setOwnerAvatar(draft.avatarUri)
    setOwnerCover(draft.coverUri)
    router.back()
  }

  const pickImage = async (target: 'avatar' | 'cover', source: 'library' | 'camera') => {
    try {
      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              quality: 0.9,
            })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              quality: 0.9,
            })
      if (result.canceled || !result.assets[0]?.uri) return
      const uri = result.assets[0].uri
      setDraft(prev => ({
        ...prev,
        [target === 'avatar' ? 'avatarUri' : 'coverUri']: uri,
      }))
    } catch {
      Alert.alert('Image unavailable', 'Modula could not open the local image picker.')
    }
  }

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <ResponsiveContent maxWidth={760}>
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.content, {gap: spacing[4], padding: spacing[4]}]}>
          <View style={styles.header}>
            <HeaderButton label="Cancel" onPress={leave} />
            <AppText variant="headline" style={styles.headerTitle}>
              Edit Profile
            </AppText>
            <HeaderButton label="Save" onPress={save} primary />
          </View>
          <Surface
            variant="contained"
            style={[styles.notice, {gap: spacing[2], padding: spacing[3]}]}>
            <AppIcon name="info" colour={colours.accent} />
            <AppText variant="caption" colour="textSecondary" style={styles.noticeText}>
              Development preview: profile identity edits are local session state only. Personal profile fields are not written to AsyncStorage.
            </AppText>
          </Surface>

          <ImageControls
            title="Avatar"
            changeLabel="Change profile picture"
            removeLabel="Remove profile picture"
            onLibrary={() => void pickImage('avatar', 'library')}
            onCamera={() => void pickImage('avatar', 'camera')}
            onRemove={() => setDraft(prev => ({...prev, avatarUri: null}))}
          />
          <ImageControls
            title="Cover"
            changeLabel="Change cover image"
            removeLabel="Remove cover image"
            onLibrary={() => void pickImage('cover', 'library')}
            onCamera={() => void pickImage('cover', 'camera')}
            onRemove={() => setDraft(prev => ({...prev, coverUri: null}))}
          />

          <ProfileField
            label="Display name"
            value={draft.displayName}
            onChangeText={value => setDraft(prev => ({...prev, displayName: value}))}
            maxLength={50}
          />
          <ProfileField
            label="Handle"
            value={draft.handle}
            onChangeText={value => setDraft(prev => ({...prev, handle: normaliseHandle(value)}))}
            autoCapitalize="none"
            maxLength={30}
            help="Availability will be checked when account services are connected."
          />
          <ProfileField
            label="Biography"
            value={draft.bio}
            onChangeText={value => setDraft(prev => ({...prev, bio: value}))}
            multiline
            maxLength={160}
            help={`${draft.bio.length}/160`}
          />
          <ProfileField
            label="Pronouns"
            value={draft.pronouns}
            onChangeText={value => setDraft(prev => ({...prev, pronouns: value}))}
          />
          <ProfileField
            label="Location"
            value={draft.location}
            onChangeText={value => setDraft(prev => ({...prev, location: value}))}
          />
          <ProfileField
            label="Website"
            value={draft.website}
            onChangeText={value => setDraft(prev => ({...prev, website: value}))}
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
                      setDraft(prev => ({
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
  removeLabel,
  onLibrary,
  onCamera,
  onRemove,
}: {
  title: string
  changeLabel: string
  removeLabel: string
  onLibrary: () => void
  onCamera: () => void
  onRemove: () => void
}) {
  const {colours, radius, spacing} = useThemeTokens()
  return (
    <Surface variant="contained" style={[styles.imageControls, {gap: spacing[3], padding: spacing[3]}]}>
      <AppText variant="headline">{title}</AppText>
      <View style={[styles.controlRow, {gap: spacing[2]}]}>
        <ControlButton label={changeLabel} icon="photo" onPress={onLibrary} />
        <ControlButton label="Take photo" icon="camera" onPress={onCamera} />
        <AppPressable
          accessibilityLabel={removeLabel}
          onPress={onRemove}
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
          <AppIcon name="trash" colour={colours.destructive} size={18} />
          <AppText variant="label">{removeLabel.replace(' image', '').replace(' picture', '')}</AppText>
        </AppPressable>
      </View>
    </Surface>
  )
}

function ControlButton({
  label,
  icon,
  onPress,
}: {
  label: string
  icon: Parameters<typeof AppIcon>[0]['name']
  onPress: () => void
}) {
  const {colours, radius, spacing} = useThemeTokens()
  return (
    <AppPressable
      accessibilityLabel={label}
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
  value,
  onChangeText,
  help,
  multiline,
  maxLength,
  autoCapitalize,
  keyboardType,
}: {
  label: string
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
