import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react'
import {useColorScheme} from 'react-native'

import type {
  AccentId,
  AdvancedChromeEffect,
  AppearanceMode,
  AppearancePreferences,
  SurfaceType,
  SystemAdaptivePreference,
  TextScale,
  TextScalePreference,
  ThemeFamily,
} from '@/theme/contracts'
import {useSystemAccessibility} from '@/theme/accessibility'
import {useSession} from '@/auth/runtime'
import {useAppServices} from '@/runtime/useAppServices'
import {validateCustomAccent} from '@/theme/accents'
import {DEFAULT_APPEARANCE_PREFERENCES} from '@/theme/data/defaults'
import {controls} from '@/theme/foundations/controls'
import {inverted} from '@/theme/foundations/inverted'
import {radius} from '@/theme/foundations/radius'
import {spacing} from '@/theme/foundations/spacing'
import {
  AppearanceActionsContext,
  type AppearanceActionsContextValue,
} from '@/theme/runtime/AppearanceActionsContext'
import {AppearanceStateContext} from '@/theme/runtime/AppearanceStateContext'
import {ThemeTokensContext, type ThemeTokenSet} from '@/theme/runtime/ThemeTokensContext'
import {resolveAppearance} from '@/theme/runtime/resolveAppearance'
import {
  isAccentId,
  isAdvancedChromeEffect,
  isAppearanceMode,
  isSurfaceType,
  isTextScale,
  isThemeFamily,
  mergeLocalAdaptivePreferences,
} from '@/theme/storage/migrateAppearancePreferences'
import {
  loadAppearanceCache,
  saveAppearanceCache,
} from '@/theme/storage/appearanceStorage'
import {useSystemUISync} from '@/theme/system'

function createTokenSet(
  resolved: ReturnType<typeof resolveAppearance>,
): ThemeTokenSet {
  return {
    ...resolved,
    appearanceMode: resolved.preferences.mode,
    resolvedColourMode: resolved.resolvedMode,
    scheme: resolved.isDark ? 'dark' : 'light',
    spacing,
    radius,
    controls,
    inverted,
    material: resolved.materials.card,
    colours: {
      ...resolved.colours,
      surface: resolved.colours.surface1,
      surfaceRaised: resolved.colours.surface2,
      surfaceMuted: resolved.colours.surface3,
      text: resolved.colours.textMain,
      textSecondary: resolved.colours.textSub,
      textTertiary: resolved.colours.textMuted,
    },
  }
}

function safePatch(
  update: (previous: AppearancePreferences) => AppearancePreferences,
): (previous: AppearancePreferences) => AppearancePreferences {
  return previous => {
    try {
      return update(previous)
    } catch (error) {
      if (__DEV__) {
        console.warn('Appearance preference update failed', error)
      }
      return previous
    }
  }
}

export function AppearanceProvider({children}: PropsWithChildren) {
  const session = useSession()
  const {appearanceRepository} = useAppServices()
  const systemColourScheme = useColorScheme()
  const systemAccessibility = useSystemAccessibility()
  const [hydrated, setHydrated] = useState(false)
  const [preferences, setPreferences] = useState<AppearancePreferences>(
    DEFAULT_APPEARANCE_PREFERENCES,
  )
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const preferencesRef = useRef(preferences)
  const versionRef = useRef(0)
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const warnedSyncFailureRef = useRef(false)

  useEffect(() => {
    preferencesRef.current = preferences
  }, [preferences])

  useEffect(() => {
    let mounted = true
    loadAppearanceCache()
      .then(cache => {
        if (!mounted) return
        if (cache) {
          versionRef.current = cache.version
          setPreferences(cache.preferences)
        }
      })
      .finally(() => {
        if (mounted) {
          setHydrated(true)
        }
      })

    return () => {
      mounted = false
    }
  }, [])

  const resolved = useMemo(
    () =>
      resolveAppearance(
        preferences,
        systemColourScheme === 'dark' ? 'dark' : 'light',
        systemAccessibility,
      ),
    [preferences, systemAccessibility, systemColourScheme],
  )

  useSystemUISync(resolved)

  useEffect(() => {
    if (!hydrated) {
      return undefined
    }

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = setTimeout(() => {
      void saveAppearanceCache({preferences, version: versionRef.current})
    }, 160)

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [hydrated, preferences])

  const syncToServer = useCallback(
    (next: AppearancePreferences) => {
      if (session.status !== 'signedIn') return
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current)
      syncTimeoutRef.current = setTimeout(() => {
        void appearanceRepository
          .patch({preferences: next, version: versionRef.current})
          .then(server => {
            versionRef.current = server.version
            warnedSyncFailureRef.current = false
            // Advanced chrome is local Preview — preserve across sync until Greenfield owns it.
            setPreferences(
              mergeLocalAdaptivePreferences(
                server.preferences,
                preferencesRef.current,
              ),
            )
          })
          .catch(error => {
            if (!warnedSyncFailureRef.current) {
              console.warn('Appearance saved on this device and will retry when available.', error)
              warnedSyncFailureRef.current = true
            }
            syncTimeoutRef.current = setTimeout(() => {
              void appearanceRepository
                .patch({preferences: next, version: versionRef.current})
                .then(server => {
                  versionRef.current = server.version
                  warnedSyncFailureRef.current = false
                  setPreferences(
                    mergeLocalAdaptivePreferences(
                      server.preferences,
                      preferencesRef.current,
                    ),
                  )
                })
                .catch(() => undefined)
            }, 30_000)
          })
      }, 300)
    },
    [appearanceRepository, session.status],
  )

  useEffect(() => {
    if (!hydrated || session.status !== 'signedIn') return
    let active = true
    void appearanceRepository
      .get()
      .then(server => {
        if (!active) return
        if (server.version >= versionRef.current) {
          versionRef.current = server.version
          setPreferences(
            mergeLocalAdaptivePreferences(
              server.preferences,
              preferencesRef.current,
            ),
          )
        } else {
          syncToServer(preferencesRef.current)
        }
      })
      .catch(error => {
        if (!warnedSyncFailureRef.current) {
          console.warn('Appearance remains available locally and will retry when online.', error)
          warnedSyncFailureRef.current = true
        }
      })
    return () => {
      active = false
    }
  }, [appearanceRepository, hydrated, session.status, syncToServer])

  const updatePreferences = useCallback(
    (updater: (previous: AppearancePreferences) => AppearancePreferences) => {
      const next = safePatch(updater)(preferencesRef.current)
      preferencesRef.current = next
      setPreferences(next)
      void saveAppearanceCache({preferences: next, version: versionRef.current})
      syncToServer(next)
    },
    [syncToServer],
  )

  const actions = useMemo<AppearanceActionsContextValue>(
    () => ({
      setMode: (mode: AppearanceMode) => {
        if (isAppearanceMode(mode)) {
          updatePreferences(prev => ({...prev, mode}))
        }
      },
      setThemeFamily: (family: ThemeFamily) => {
        if (isThemeFamily(family)) {
          updatePreferences(prev => ({...prev, family}))
        }
      },
      setAccent: (accentId: AccentId) => {
        if (isAccentId(accentId)) {
          updatePreferences(prev => ({...prev, accentId}))
        }
      },
      setCustomAccent: (hex: string) => {
        const validation = validateCustomAccent(hex)
        if (!validation.valid) {
          if (__DEV__) {
            console.warn('Invalid custom accent ignored', validation.message)
          }
          return
        }
        updatePreferences(prev => ({
          ...prev,
          accentId: 'custom',
          customAccent: validation.value,
        }))
      },
      setSurfaceType: (surfaceType: SurfaceType) => {
        if (isSurfaceType(surfaceType)) {
          updatePreferences(prev => ({...prev, surfaceType}))
        }
      },
      setTextScale: (textScale: TextScale) => {
        if (isTextScale(textScale)) {
          updatePreferences(prev => ({
            ...prev,
            textScale,
            textScalePreference: {mode: 'custom', scale: textScale},
          }))
        }
      },
      setTextScalePreference: (textScalePreference: TextScalePreference) => {
        updatePreferences(prev => ({
          ...prev,
          textScalePreference,
          textScale:
            textScalePreference.mode === 'custom'
              ? textScalePreference.scale
              : prev.textScale,
        }))
      },
      setBoldText: (boldText: SystemAdaptivePreference) => {
        updatePreferences(prev => ({...prev, boldText}))
      },
      setReduceMotion: (reduceMotion: SystemAdaptivePreference) => {
        updatePreferences(prev => ({...prev, reduceMotion}))
      },
      setReduceTransparency: (reduceTransparency: SystemAdaptivePreference) => {
        updatePreferences(prev => ({...prev, reduceTransparency}))
      },
      setIncreaseContrast: (increaseContrast: SystemAdaptivePreference) => {
        updatePreferences(prev => ({...prev, increaseContrast}))
      },
      setDifferentiateWithoutColor: (
        differentiateWithoutColor: SystemAdaptivePreference,
      ) => {
        updatePreferences(prev => ({...prev, differentiateWithoutColor}))
      },
      setShowSwitchLabels: (showSwitchLabels: SystemAdaptivePreference) => {
        updatePreferences(prev => ({...prev, showSwitchLabels}))
      },
      setAdvancedChromeEffect: (advancedChromeEffect: AdvancedChromeEffect) => {
        if (isAdvancedChromeEffect(advancedChromeEffect)) {
          updatePreferences(prev => ({...prev, advancedChromeEffect}))
        }
      },
      resetAppearance: () => {
        updatePreferences(() => DEFAULT_APPEARANCE_PREFERENCES)
      },
    }),
    [updatePreferences],
  )

  const themeTokens = useMemo(() => createTokenSet(resolved), [resolved])
  const stateValue = useMemo(
    () => ({preferences, resolved, hydrated, systemAccessibility}),
    [hydrated, preferences, resolved, systemAccessibility],
  )

  return (
    <AppearanceStateContext.Provider value={stateValue}>
      <AppearanceActionsContext.Provider value={actions}>
        <ThemeTokensContext.Provider value={themeTokens}>
          {children}
        </ThemeTokensContext.Provider>
      </AppearanceActionsContext.Provider>
    </AppearanceStateContext.Provider>
  )
}
