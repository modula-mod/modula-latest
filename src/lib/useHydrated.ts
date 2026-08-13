import {useSyncExternalStore} from 'react'
import {Platform} from 'react-native'

let hydrated = false
const listeners = new Set<() => void>()

function notifySoon(listener?: () => void) {
  const notify = () => {
    if (listener) {
      listener()
      return
    }
    for (const next of listeners) next()
  }
  if (typeof queueMicrotask === 'function') {
    queueMicrotask(notify)
    return
  }
  setTimeout(notify, 0)
}

function subscribe(listener: () => void) {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return () => undefined
  listeners.add(listener)
  if (!hydrated) {
    hydrated = true
    notifySoon()
  } else {
    notifySoon(listener)
  }
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot() {
  return Platform.OS === 'web' ? hydrated : true
}

function getServerSnapshot() {
  return false
}

export function useHydrated() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
