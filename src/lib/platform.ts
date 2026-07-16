import {Platform} from 'react-native'

import {runtimeEnvironment} from '@/config/runtimeEnvironment'

export const isWeb = Platform.OS === 'web'
export const isIOS = Platform.OS === 'ios'
export const isAndroid = Platform.OS === 'android'

export function isDevelopmentBuild(): boolean {
  return runtimeEnvironment.appEnvironment === 'development'
}
