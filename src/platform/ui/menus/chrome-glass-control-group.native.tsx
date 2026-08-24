import type {ComponentType, ReactNode} from 'react'
import {StyleSheet, View, type StyleProp, type ViewStyle} from 'react-native'

import type {AppIconName} from '@/components/primitives/AppIcon'
import {ModulaIconButton} from '@/platform/ui/buttons/modula-icon-button'
import {LiquidGlassChrome} from '@/platform/ui/materials/liquid-glass-chrome'
import {ChromeIconMenu} from '@/platform/ui/menus/chrome-icon-menu'
import {isCallstackLiquidGlassNativeAvailable} from '@/platform/ui/navigation/liquid-glass-availability'
import {
  OVERLAY_GROUP_GAP,
  OVERLAY_GROUP_HIT,
  OVERLAY_GROUP_MIN_WIDTH,
  overlayGroupWidth,
  TOOLBAR_HIT,
} from '@/platform/ui/menus/toolbar-chrome'
import {HEADER_ICON_PAIR_GAP} from '@/platform/ui/navigation/plain-header-items'
import type {ModulaActionItem} from '@/platform/ui/menus/types'
import {useSystemAccessibility} from '@/theme/accessibility/useSystemAccessibility'
import {isNativeGlassRuntimeAvailable} from '@/theme/materials/nativeMaterial'

export type ChromeGlassGroupButton = {
  kind: 'button'
  icon: AppIconName
  accessibilityLabel: string
  onPress: () => void
}

export type ChromeGlassGroupMenu = {
  kind: 'menu'
  icon?: AppIconName
  accessibilityLabel: string
  title?: string
  actions: ModulaActionItem[]
  onAction: (id: string) => void
}

export type ChromeGlassGroupItem = ChromeGlassGroupButton | ChromeGlassGroupMenu

if (OVERLAY_GROUP_HIT !== TOOLBAR_HIT || HEADER_ICON_PAIR_GAP !== OVERLAY_GROUP_GAP) {
  throw new Error('Overlay group must match Home header sizes (44pt hit, 22pt gap)')
}
if (overlayGroupWidth(2) !== OVERLAY_GROUP_MIN_WIDTH) {
  throw new Error('overlayGroupWidth(2) must equal OVERLAY_GROUP_MIN_WIDTH')
}

type GlassViewProps = {
  style?: StyleProp<ViewStyle>
  interactive?: boolean
  isInteractive?: boolean
  effect?: 'clear' | 'regular' | 'none'
  glassEffectStyle?: string
  children?: ReactNode
}

type CallstackModule = {
  LiquidGlassView: ComponentType<GlassViewProps>
  isLiquidGlassSupported: boolean
}

type ExpoGlassModule = {
  GlassView: ComponentType<GlassViewProps>
}

let cachedCallstack: CallstackModule | null | undefined
let cachedExpoGlass: ExpoGlassModule | null | undefined

function loadCallstack(): CallstackModule | null {
  if (cachedCallstack !== undefined) return cachedCallstack
  if (!isCallstackLiquidGlassNativeAvailable()) {
    cachedCallstack = null
    return null
  }
  try {
    // Dynamic require — static import crashes Expo Go / missing pods.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cachedCallstack = require('@callstack/liquid-glass') as CallstackModule
  } catch {
    cachedCallstack = null
  }
  return cachedCallstack
}

function loadExpoGlass(): ExpoGlassModule | null {
  if (cachedExpoGlass !== undefined) return cachedExpoGlass
  if (!isNativeGlassRuntimeAvailable()) {
    cachedExpoGlass = null
    return null
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cachedExpoGlass = require('expo-glass-effect') as ExpoGlassModule
  } catch {
    cachedExpoGlass = null
  }
  return cachedExpoGlass
}

/**
 * THE shared Home-style control group.
 *
 * One liquid-glass capsule. Plain 44pt glyphs inside with 22pt gap.
 * Never separate glass discs — that reads as buttons, not a control group.
 *
 * Home iOS uses UIKit `unstable_header*Items` for the same look; every other
 * surface (Product Hub, Profile cover, product detail, Home Android/web)
 * mounts this component.
 */
export function ChromeGlassControlGroup({items}: {items: ChromeGlassGroupItem[]}) {
  const {reduceTransparency} = useSystemAccessibility()
  const width = overlayGroupWidth(items.length)
  const capsuleStyle: StyleProp<ViewStyle> = [
    styles.capsule,
    {minWidth: width, width},
  ]
  const content = <View style={[styles.row, {minWidth: width, width}]}>{items.map(renderSlot)}</View>

  if (reduceTransparency) {
    return <View style={capsuleStyle}>{content}</View>
  }

  const callstack = loadCallstack()
  if (callstack?.isLiquidGlassSupported) {
    const {LiquidGlassView} = callstack
    return (
      <LiquidGlassView interactive effect="regular" style={capsuleStyle}>
        {content}
      </LiquidGlassView>
    )
  }

  const expo = loadExpoGlass()
  if (expo?.GlassView) {
    return (
      <expo.GlassView isInteractive glassEffectStyle="regular" style={capsuleStyle}>
        {content}
      </expo.GlassView>
    )
  }

  return (
    <LiquidGlassChrome
      interactive
      fallback="regular"
      contentLayout="flow"
      style={capsuleStyle}>
      {content}
    </LiquidGlassChrome>
  )
}

function renderSlot(item: ChromeGlassGroupItem) {
  return (
    <View key={item.accessibilityLabel} style={styles.hit}>
      {item.kind === 'button' ? (
        <ModulaIconButton
          icon={item.icon}
          chrome="plain"
          accessibilityLabel={item.accessibilityLabel}
          onPress={item.onPress}
        />
      ) : (
        <ChromeIconMenu
          icon={item.icon ?? 'more'}
          chrome="plain"
          accessibilityLabel={item.accessibilityLabel}
          title={item.title}
          actions={item.actions}
          onAction={item.onAction}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  capsule: {
    borderRadius: OVERLAY_GROUP_HIT / 2,
    flexGrow: 0,
    flexShrink: 0,
    height: OVERLAY_GROUP_HIT,
    minHeight: OVERLAY_GROUP_HIT,
  },
  hit: {
    alignItems: 'center',
    flexGrow: 0,
    flexShrink: 0,
    height: OVERLAY_GROUP_HIT,
    justifyContent: 'center',
    width: OVERLAY_GROUP_HIT,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    flexGrow: 0,
    flexShrink: 0,
    gap: HEADER_ICON_PAIR_GAP,
    height: OVERLAY_GROUP_HIT,
    justifyContent: 'center',
  },
})
