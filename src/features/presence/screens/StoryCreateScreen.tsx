import * as ImagePicker from 'expo-image-picker'
import {useRouter, type Href} from 'expo-router'
import {useState} from 'react'
import {Image, StyleSheet, View} from 'react-native'
import {useQueryClient} from '@tanstack/react-query'

import {AppScreen} from '@/components/primitives/AppScreen'
import {AppText} from '@/components/primitives/AppText'
import {queryKeys} from '@/data/query'
import {useSession} from '@/auth/runtime'
import {ModulaButton} from '@/platform/ui/buttons/modula-button'
import {ModulaSegmentedPicker} from '@/platform/ui/controls/modula-segmented-picker'
import {ModulaTextInput} from '@/platform/ui/controls/modula-text-input'
import {useAppServices} from '@/runtime'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function StoryCreateScreen() {
  const router = useRouter()
  const session = useSession()
  const {storiesRepository} = useAppServices()
  const queryClient = useQueryClient()
  const {colours, spacing} = useThemeTokens()
  const [previewUri, setPreviewUri] = useState<string | null>(null)
  const [selectedBase64, setSelectedBase64] = useState<string | null>(null)
  const [contentType, setContentType] = useState('image/jpeg')
  const [caption, setCaption] = useState('')
  const [visibility, setVisibility] = useState<'followers' | 'public'>('followers')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      base64: true,
    })
    if (result.canceled || !result.assets[0]) return
    const asset = result.assets[0]
    setPreviewUri(asset.uri)
    setSelectedBase64(asset.base64 ?? null)
    setContentType(asset.mimeType ?? 'image/jpeg')
    setError(asset.base64 ? null : 'Photo data was not available. Choose a different photo and try again.')
  }

  const publish = async () => {
    if (!previewUri || session.status !== 'signedIn') return
    if (!selectedBase64) {
      setError('Photo data was not available. Choose a different photo and try again.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const group = await storiesRepository.create({
        mediaKind: 'image',
        base64: selectedBase64,
        contentType,
        caption,
        visibility,
      })
      await queryClient.invalidateQueries({
        queryKey: queryKeys.stories.rail(session.account.id),
      })
      router.replace(`/stories/${encodeURIComponent(group.groupId)}` as Href)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create story.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AppScreen scroll style={{padding: spacing[4], gap: spacing[4]}}>
      <AppText variant="title">Add Story</AppText>
      <AppText variant="body" colour="textSecondary">
        Choose a photo from your library. Stories expire after 24 hours.
      </AppText>
      {previewUri ? (
        <Image
          source={{uri: previewUri}}
          style={[styles.preview, {backgroundColor: colours.surfaceMuted}]}
        />
      ) : (
        <View
          style={[
            styles.placeholder,
            {backgroundColor: colours.surfaceMuted},
          ]}>
          <AppText colour="textSecondary">No photo selected</AppText>
        </View>
      )}
      <ModulaButton label="Choose photo" role="secondary" onPress={() => void pickPhoto()} />
      <ModulaTextInput
        value={caption}
        onChangeText={setCaption}
        placeholder="Optional caption"
        accessibilityLabel="Story caption"
        maxLength={500}
      />
      <ModulaSegmentedPicker
        appearance="segmented"
        accessibilityLabel="Story visibility"
        options={[
          {value: 'followers', label: 'Followers'},
          {value: 'public', label: 'Public'},
        ]}
        value={visibility}
        onValueChange={next => {
          if (next === 'followers' || next === 'public') setVisibility(next)
        }}
      />
      {error ? (
        <AppText colour="destructive" variant="caption">
          {error}
        </AppText>
      ) : null}
      <ModulaButton
        label="Share story"
        role="primary"
        loading={busy}
        disabled={!previewUri || busy}
        onPress={() => void publish()}
      />
      <ModulaButton label="Cancel" role="quiet" onPress={() => router.back()} />
    </AppScreen>
  )
}

const styles = StyleSheet.create({
  preview: {
    width: '100%',
    aspectRatio: 9 / 16,
    borderRadius: 16,
  },
  placeholder: {
    width: '100%',
    aspectRatio: 9 / 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
