import {Platform} from 'react-native'

export const isWeb = Platform.OS === 'web'
export const isIOS = Platform.OS === 'ios'
export const isAndroid = Platform.OS === 'android'

export function isDevelopmentBuild(): boolean {
  return process.env.EXPO_PUBLIC_APP_ENV === 'development'
}
