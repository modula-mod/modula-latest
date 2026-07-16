import {Platform} from 'react-native'

import {NativeSecureSessionStorage} from '@/auth/storage/NativeSecureSessionStorage'
import {WebMemorySessionStorage} from '@/auth/storage/WebMemorySessionStorage'
import type {SessionStorage} from '@/auth/storage/SessionStorage'

export function createSessionStorage(input?: {
  shouldFail?: () => boolean
}): SessionStorage {
  if (Platform.OS === 'web') return new WebMemorySessionStorage()
  return new NativeSecureSessionStorage(input?.shouldFail)
}
