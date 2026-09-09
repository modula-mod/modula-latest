import {createContext, useContext, type PropsWithChildren} from 'react'

import {LAYERS} from '@/theme/tokens/layers'

export type ModulaOverlayRole = 'popover' | 'drawer' | 'sheet' | 'dialog' | 'toast' | 'critical'

type OverlayLayer = {
  backdrop: number
  content: number
}

const OverlayParentLayerContext = createContext<number>(LAYERS.content)

const ROLE_LAYER: Record<ModulaOverlayRole, number> = {
  popover: LAYERS.popover,
  drawer: LAYERS.sheet,
  sheet: LAYERS.sheet,
  dialog: LAYERS.dialog,
  toast: LAYERS.toast,
  critical: LAYERS.critical,
}

/**
 * Resolve a portal layer relative to its React parent. Portals retain this
 * context, so a menu opened by a dialog is always above that dialog even when
 * the popover's global base layer would otherwise be lower.
 */
export function useModulaOverlayLayer(role: ModulaOverlayRole): OverlayLayer {
  const parent = useContext(OverlayParentLayerContext)
  const content = Math.max(ROLE_LAYER[role], parent + 2)
  return {backdrop: content - 1, content}
}

export function ModulaOverlayLayerScope({
  children,
  layer,
}: PropsWithChildren<{layer: number}>) {
  return (
    <OverlayParentLayerContext.Provider value={layer}>
      {children}
    </OverlayParentLayerContext.Provider>
  )
}
