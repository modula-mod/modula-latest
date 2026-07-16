import {Alert, Linking} from 'react-native'

export type SafeExternalUrlResult =
  | {valid: true; url: string}
  | {valid: false; message: string}

const ALLOWED_PROTOCOLS = new Set(['https:', 'http:', 'mailto:'])

export function getSafeExternalUrl(value: string): SafeExternalUrlResult {
  const trimmed = value.trim()
  if (!trimmed.length) {
    return {valid: false, message: 'This link is empty.'}
  }

  try {
    const url = new URL(trimmed)
    if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
      return {valid: false, message: 'This link type is not supported.'}
    }
    return {valid: true, url: url.toString()}
  } catch {
    return {valid: false, message: 'This link is not a valid URL.'}
  }
}

export async function openSafeExternalUrl(value: string): Promise<boolean> {
  const result = getSafeExternalUrl(value)
  if (!result.valid) {
    Alert.alert('Cannot open link', result.message)
    return false
  }

  try {
    const supported = await Linking.canOpenURL(result.url)
    if (!supported) {
      Alert.alert('Cannot open link', 'This device cannot open that link.')
      return false
    }
    await Linking.openURL(result.url)
    return true
  } catch {
    Alert.alert('Cannot open link', 'Modula could not open this link.')
    return false
  }
}
