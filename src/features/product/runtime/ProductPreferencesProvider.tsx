import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react'

import {useSession} from '@/auth/runtime'
import {
  DEFAULT_PRODUCT_PREFERENCES,
  loadProductPreferences,
  patchProductPreferences,
  resetProductPreferences,
  type ProductPreferences,
} from '@/features/product/storage/productPreferencesStorage'
import {useAppServices} from '@/runtime'

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
  const session = useSession()
  const {productPreferencesRepository} = useAppServices()
  const [preferences, setPreferences] = useState<ProductPreferences>(
    DEFAULT_PRODUCT_PREFERENCES,
  )
  const [ready, setReady] = useState(false)
  const boardLayoutVersionRef = useRef<number | null>(null)
  const accountId = session.status === 'signedIn' ? session.account.id : null

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

  useEffect(() => {
    if (!ready || !accountId) return undefined
    let mounted = true
    void productPreferencesRepository
      .getBoardLayout()
      .then(async layout => {
        if (!mounted) return
        boardLayoutVersionRef.current = layout.version
        const next = await patchProductPreferences({boardWidgetIds: layout.boardWidgetIds})
        if (mounted) setPreferences(next)
      })
      .catch(() => {
        // Local Board layout remains authoritative while offline.
      })
    return () => {
      mounted = false
    }
  }, [accountId, productPreferencesRepository, ready])

  const update = useCallback(async (patch: Partial<ProductPreferences>) => {
    const next = await patchProductPreferences(patch)
    setPreferences(next)
    if (accountId && Object.prototype.hasOwnProperty.call(patch, 'boardWidgetIds')) {
      void productPreferencesRepository
        .updateBoardLayout({
          boardWidgetIds: next.boardWidgetIds,
          expectedVersion: boardLayoutVersionRef.current ?? undefined,
        })
        .then(layout => {
          boardLayoutVersionRef.current = layout.version
        })
        .catch(() => {
          // Offline and transient failures keep the local optimistic Board layout.
        })
    }
    return next
  }, [accountId, productPreferencesRepository])

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
