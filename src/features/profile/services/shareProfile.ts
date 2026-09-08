import {Alert, Platform, Share} from 'react-native'
import * as Clipboard from 'expo-clipboard'

import type {ModulaProfile} from '@/features/profile/contracts/profile'

export function getProfilePreviewUrl(profile: ModulaProfile): string {
  return `https://modula.digital/@${profile.handle}`
}

export function createProfileShareText(profile: ModulaProfile): string {
  return `${profile.displayName} on Modula\n@${profile.handle}\n${getProfilePreviewUrl(profile)}`
}

export async function shareProfile(profile: ModulaProfile): Promise<boolean> {
  const message = createProfileShareText(profile)

  try {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && 'share' in navigator) {
      const share = navigator.share as ((data: {title: string; text: string; url: string}) => Promise<void>)
      await share({
        title: `${profile.displayName} on Modula`,
        text: `@${profile.handle}`,
        url: getProfilePreviewUrl(profile),
      })
      return true
    }

    await Share.share({
      title: `${profile.displayName} on Modula`,
      message,
      url: getProfilePreviewUrl(profile),
    })
    return true
  } catch {
    if (Platform.OS !== 'web') Alert.alert('Share unavailable', message)
    return false
  }
}

export async function copyProfileLink(profile: ModulaProfile): Promise<boolean> {
  const url = getProfilePreviewUrl(profile)
  try {
    await Clipboard.setStringAsync(url)
    if (Platform.OS !== 'web') Alert.alert('Profile link copied', url)
    return true
  } catch (error) {
    if (Platform.OS !== 'web') {
      Alert.alert(
        'Copy failed',
        error instanceof Error ? error.message : 'The profile link could not be copied.',
      )
    }
    return false
  }
}
