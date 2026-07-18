import {useCallback, useEffect, useState} from 'react'

import {
  DEFAULT_PRODUCT_PREFERENCES,
  loadProductPreferences,
  patchProductPreferences,
  type ProductPreferences,
} from '@/features/product/storage/productPreferencesStorage'

export function useProductPreferences() {
  const [preferences, setPreferences] = useState<ProductPreferences>(DEFAULT_PRODUCT_PREFERENCES)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let mounted = true
    void loadProductPreferences().then(value => {
      if (!mounted) return
      setPreferences(value)
      setReady(true)
    })
    return () => {
      mounted = false
    }
  }, [])

  const update = useCallback(async (patch: Partial<ProductPreferences>) => {
    const next = await patchProductPreferences(patch)
    setPreferences(next)
    return next
  }, [])

  return {preferences, ready, update}
}
