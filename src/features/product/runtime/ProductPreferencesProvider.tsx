import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react'

import {
  DEFAULT_PRODUCT_PREFERENCES,
  loadProductPreferences,
  patchProductPreferences,
  resetProductPreferences,
  type ProductPreferences,
} from '@/features/product/storage/productPreferencesStorage'

type ProductPreferencesApi = {
  preferences: ProductPreferences
  ready: boolean
  update: (patch: Partial<ProductPreferences>) => Promise<ProductPreferences>
  reset: () => Promise<ProductPreferences>
}

const ProductPreferencesContext = createContext<ProductPreferencesApi | null>(null)

/**
 * Shared product/customize preferences so studios and live surfaces stay in sync
 * without each mount reloading AsyncStorage independently.
 */
export function ProductPreferencesProvider({children}: PropsWithChildren) {
  const [preferences, setPreferences] = useState<ProductPreferences>(
    DEFAULT_PRODUCT_PREFERENCES,
  )
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

  const reset = useCallback(async () => {
    const next = await resetProductPreferences()
    setPreferences(next)
    return next
  }, [])

  const value = useMemo(
    () => ({preferences, ready, update, reset}),
    [preferences, ready, reset, update],
  )

  return (
    <ProductPreferencesContext.Provider value={value}>
      {children}
    </ProductPreferencesContext.Provider>
  )
}

export function useProductPreferences(): ProductPreferencesApi {
  const ctx = useContext(ProductPreferencesContext)
  if (ctx) return ctx
  return {
    preferences: DEFAULT_PRODUCT_PREFERENCES,
    ready: false,
    update: async () => DEFAULT_PRODUCT_PREFERENCES,
    reset: async () => DEFAULT_PRODUCT_PREFERENCES,
  }
}
