import {useSyncExternalStore} from 'react'
import {Platform} from 'react-native'

const emptySubscribe = () => () => {}
const getClientSnapshot = () => true
const getServerSnapshot = () => false

/**
 * True after the client has mounted. Server/static render and the hydration
 * render stay false on web so exported HTML and hydration see the same tree.
 * Implemented with useSyncExternalStore so React resolves the server/client
 * mismatch itself (no setState-in-effect).
 */
export function useHydrated() {
  const hydrated = useSyncExternalStore(
    emptySubscribe,
    getClientSnapshot,
    getServerSnapshot,
  )

  return Platform.OS !== 'web' ? true : hydrated
}
