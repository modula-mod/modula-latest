import {WebPersistentSessionStorage} from '@/auth/storage/WebPersistentSessionStorage'
import type {SessionStorage} from '@/auth/storage/SessionStorage'

export function createSessionStorage(input?: {
  shouldFail?: () => boolean
}): SessionStorage {
  if (input?.shouldFail?.()) {
    throw new Error('Session storage is unavailable in this simulation.')
  }
  return new WebPersistentSessionStorage()
}
