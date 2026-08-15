import {useEffect, useState} from 'react'
import {Platform} from 'react-native'

/**
 * True after the client has mounted. Server render and the first client render
 * stay false on web so static HTML and hydration see the same tree.
 */
export function useHydrated() {
  const [hydrated, setHydrated] = useState(() => Platform.OS !== 'web')

  useEffect(() => {
    setHydrated(true)
  }, [])

  return hydrated
}
