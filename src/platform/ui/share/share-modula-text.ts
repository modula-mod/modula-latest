import {Alert, Platform, Share} from 'react-native'

export async function shareModulaText(input: {
  title: string
  message: string
  url?: string
}): Promise<void> {
  const body = input.url ? `${input.message}\n${input.url}` : input.message

  try {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && 'share' in navigator) {
      const share = navigator.share as (data: {
        title: string
        text: string
        url?: string
      }) => Promise<void>
      await share({
        title: input.title,
        text: input.message,
        url: input.url,
      })
      return
    }

    await Share.share({
      title: input.title,
      message: body,
      url: input.url,
    })
  } catch {
    Alert.alert(input.title, body)
  }
}
