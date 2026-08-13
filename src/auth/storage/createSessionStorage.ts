import {Platform} from 'react-native'

import {NativeSecureSessionStorage} from '@/auth/storage/NativeSecureSessionStorage'
import {WebPersistentSessionStorage} from '@/auth/storage/WebPersistentSessionStorage'
import type {SessionStorage} from '@/auth/storage/SessionStorage'

export function createSessionStorage(input?: {
  shouldFail?: () => boolean
}): SessionStorage {
  if (Platform.OS === 'web') return new WebPersistentSessionStorage()
  return new NativeSecureSessionStorage(input?.shouldFail)
}
