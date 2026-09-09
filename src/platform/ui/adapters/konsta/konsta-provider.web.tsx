import {KonstaProvider} from 'konsta/react'
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  type ComponentProps,
  type ComponentType,
  type PropsWithChildren,
} from 'react'

import {
  resolveKonstaTheme,
  resolvePresentationClass,
} from '@/platform/ui/adapters/konsta/konsta-theme'
import {konstaCssVariables} from '@/platform/ui/adapters/konsta/tokens.web'
import type {WebPresentation} from '@/theme/contracts'
import type {ThemeTokenSet} from '@/theme/runtime/ThemeTokensContext'

const useIsomorphicLayoutEffect = typeof document === 'undefined' ? useEffect : useLayoutEffect

type KonstaPresentationRootProps = PropsWithChildren<{
  presentation: WebPresentation
  tokens: ThemeTokenSet
}>

/*
 * Konsta 5.4.0 implements this prop but omits it from KonstaProviderProps.
 * Keeping the narrow compatibility cast here makes presentation changes atomic
 * instead of waiting for Konsta's layout-effect auto detection.
 */
const AtomicKonstaProvider = KonstaProvider as ComponentType<
  PropsWithChildren<ComponentProps<typeof KonstaProvider> & {autoThemeDetection?: boolean}>
>

export function KonstaPresentationRoot({
  children,
  presentation,
  tokens,
}: KonstaPresentationRootProps) {
  const theme = resolveKonstaTheme(presentation)
  const presentationClass = resolvePresentationClass(presentation)
  const dark = tokens.isDark
  const variables = useMemo(() => konstaCssVariables(tokens), [tokens])

  useIsomorphicLayoutEffect(() => {
    const root = document.documentElement
    const previousVariables = new Map<string, string>()
    for (const [name, value] of Object.entries(variables)) {
      if (!name.startsWith('--')) continue
      previousVariables.set(name, root.style.getPropertyValue(name))
      root.style.setProperty(name, String(value))
    }
    root.dataset.modulaPresentation = presentation
    root.dataset.modulaAppearance = tokens.resolvedColourMode
    root.classList.toggle('k-ios', presentationClass === 'k-ios')
    root.classList.toggle('k-material', presentationClass === 'k-material')
    root.classList.toggle('dark', dark)
    return () => {
      delete root.dataset.modulaPresentation
      delete root.dataset.modulaAppearance
      root.classList.remove('k-ios', 'k-material', 'dark')
      for (const [name, previous] of previousVariables) {
        if (previous) root.style.setProperty(name, previous)
        else root.style.removeProperty(name)
      }
    }
  }, [dark, presentation, presentationClass, tokens.resolvedColourMode, variables])

  return (
    <AtomicKonstaProvider
      autoThemeDetection={false}
      dark={dark}
      iosHoverHighlight={presentation === 'liquid'}
      materialTouchRipple={presentation === 'material'}
      theme={theme}>
      <div
        className={`modula-konsta-root ${presentationClass}`}
        data-modula-presentation={presentation}
        data-modula-appearance={tokens.resolvedColourMode}
        data-reduce-motion={String(tokens.accessibility.reduceMotion)}
        style={variables}>
        {children}
      </div>
    </AtomicKonstaProvider>
  )
}
