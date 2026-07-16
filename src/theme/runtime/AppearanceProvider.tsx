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
  AppearanceMode,
  AppearancePreferences,
  SurfaceType,
  TextScale,
  ThemeFamily,
} from '@/theme/contracts'
import {useSystemAccessibility} from '@/theme/accessibility'
import {validateCustomAccent} from '@/theme/accents'
import {DEFAULT_APPEARANCE_PREFERENCES} from '@/theme/data/defaults'
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
  isAppearanceMode,
  isSurfaceType,
  isTextScale,
  isThemeFamily,
} from '@/theme/storage/migrateAppearancePreferences'
import {
  loadAppearancePreferences,
  saveAppearancePreferences,
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
  const systemColourScheme = useColorScheme()
  const systemAccessibility = useSystemAccessibility()
  const [hydrated, setHydrated] = useState(false)
  const [preferences, setPreferences] = useState<AppearancePreferences>(
    DEFAULT_APPEARANCE_PREFERENCES,
  )
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let mounted = true
    loadAppearancePreferences()
      .then(next => {
        if (!mounted) return
        if (next) {
          setPreferences(next)
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
      void saveAppearancePreferences(preferences)
    }, 160)

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [hydrated, preferences])

  const updatePreferences = useCallback(
    (updater: (previous: AppearancePreferences) => AppearancePreferences) => {
      setPreferences(safePatch(updater))
    },
    [],
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
          updatePreferences(prev => ({...prev, textScale}))
        }
      },
      setBoldText: (boldText: boolean) => {
        updatePreferences(prev => ({...prev, boldText}))
      },
      setReduceMotion: (reduceMotion: boolean) => {
        updatePreferences(prev => ({...prev, reduceMotion}))
      },
      setReduceTransparency: (reduceTransparency: boolean) => {
        updatePreferences(prev => ({...prev, reduceTransparency}))
      },
      setIncreaseContrast: (increaseContrast: boolean) => {
        updatePreferences(prev => ({...prev, increaseContrast}))
      },
      setShowSwitchLabels: (showSwitchLabels: boolean) => {
        updatePreferences(prev => ({...prev, showSwitchLabels}))
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
