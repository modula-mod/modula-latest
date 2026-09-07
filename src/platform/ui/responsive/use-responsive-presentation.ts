import {useEffect, useState} from 'react'
import {Platform} from 'react-native'

import {useResponsiveLayout} from '@/layout/useResponsiveLayout'
import {
  resolvePresentation,
  resolveUnanchoredPresentation,
  type ModulaOverlayIntent,
  type ModulaPointerType,
  type ModulaResolvedPresentation,
} from '@/platform/ui/responsive/presentation-resolver'

type WebCapabilities = {
  pointer: ModulaPointerType
  hover: boolean
  standalone: boolean
}

const DEFAULT_CAPABILITIES: WebCapabilities = {
  pointer: 'none',
  hover: false,
  standalone: false,
}

function readWebCapabilities(): WebCapabilities {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return DEFAULT_CAPABILITIES
  }
  return {
    pointer: window.matchMedia('(pointer: fine)').matches
      ? 'fine'
      : window.matchMedia('(pointer: coarse)').matches
        ? 'coarse'
        : 'none',
    hover: window.matchMedia('(hover: hover)').matches,
    standalone:
      window.matchMedia('(display-mode: standalone)').matches ||
      Boolean((window.navigator as Navigator & {standalone?: boolean}).standalone),
  }
}

export function useResponsivePresentation(
  intent: ModulaOverlayIntent,
  options: {anchored?: boolean} = {},
): ModulaResolvedPresentation {
  const {layoutClass} = useResponsiveLayout()
  const [capabilities, setCapabilities] = useState<WebCapabilities>(DEFAULT_CAPABILITIES)

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return
    const queries = [
      window.matchMedia('(pointer: fine)'),
      window.matchMedia('(pointer: coarse)'),
      window.matchMedia('(hover: hover)'),
      window.matchMedia('(display-mode: standalone)'),
    ]
    const update = () => setCapabilities(readWebCapabilities())
    update()
    queries.forEach(query => query.addEventListener?.('change', update))
    return () => queries.forEach(query => query.removeEventListener?.('change', update))
  }, [])

  const environment = {
    intent,
    viewport: layoutClass,
    pointer: capabilities.pointer,
    hover: capabilities.hover,
    standalone: capabilities.standalone,
    platform: Platform.OS === 'web' || Platform.OS === 'ios' || Platform.OS === 'android'
      ? Platform.OS
      : 'unknown',
  } as const

  return options.anchored === false
    ? resolveUnanchoredPresentation(environment)
    : resolvePresentation(environment)
}
