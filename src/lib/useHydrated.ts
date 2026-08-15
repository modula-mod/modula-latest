import {useEffect, useState} from 'react'
import {Platform} from 'react-native'

/**
 * True after the client has mounted. Server/static render and the first client
 * render stay false on web so exported HTML and hydration see the same tree.
 */
export function useHydrated() {
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setHydrated(true)
  }, [])

  if (typeof window === 'undefined') {
    return Platform.OS !== 'web'
  }

  return Platform.OS !== 'web' ? true : hydrated
}
