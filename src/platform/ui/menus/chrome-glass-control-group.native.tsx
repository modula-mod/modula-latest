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

type GlassSlotProps = {
  style?: StyleProp<ViewStyle>
  interactive?: boolean
  children?: ReactNode
}

type GlassContainerProps = {
  spacing?: number
  style?: StyleProp<ViewStyle>
  children?: ReactNode
}

type CallstackModule = {
  LiquidGlassView: ComponentType<GlassSlotProps & {effect?: 'clear' | 'regular' | 'none'}>
  LiquidGlassContainerView: ComponentType<GlassContainerProps>
  isLiquidGlassSupported: boolean
}

type ExpoGlassModule = {
  GlassView: ComponentType<
    GlassSlotProps & {
      glassEffectStyle?: string
      isInteractive?: boolean
    }
  >
  GlassContainer: ComponentType<GlassContainerProps>
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
 * Home-parity overlay control group.
 *
 * Home uses UIKit shared header liquid glass (`unstable_header*Items`).
 * Overlay screens cannot use that API, so this mirrors it with
 * LiquidGlassContainerView / GlassContainer: each 44pt plain glyph sits in
 * its own glass disc, and the container merges them into one continuous
 * capsule (same material as Home — not a BlurView pill with a drop shadow).
 */
export function ChromeGlassControlGroup({items}: {items: ChromeGlassGroupItem[]}) {
  const {reduceTransparency} = useSystemAccessibility()
  const width = overlayGroupWidth(items.length)
  const rowStyle: StyleProp<ViewStyle> = [styles.row, {minWidth: width, width}]

  if (reduceTransparency) {
    return (
      <View style={[styles.fallbackCapsule, {minWidth: width, width}]}>
        <View style={rowStyle}>{items.map(renderPlainSlot)}</View>
      </View>
    )
  }

  const callstack = loadCallstack()
  if (callstack?.isLiquidGlassSupported) {
    const {LiquidGlassContainerView, LiquidGlassView} = callstack
    return (
      <LiquidGlassContainerView spacing={HEADER_ICON_PAIR_GAP} style={rowStyle}>
        {items.map(item => (
          <LiquidGlassView
            key={item.accessibilityLabel}
            interactive
            effect="regular"
            style={styles.glassDisc}>
            <View style={styles.hit}>{renderPlainControl(item)}</View>
          </LiquidGlassView>
        ))}
      </LiquidGlassContainerView>
    )
  }

  const expo = loadExpoGlass()
  if (expo?.GlassContainer && expo.GlassView) {
    const {GlassContainer, GlassView} = expo
    return (
      <GlassContainer spacing={HEADER_ICON_PAIR_GAP} style={rowStyle}>
        {items.map(item => (
          <GlassView
            key={item.accessibilityLabel}
            isInteractive
            glassEffectStyle="regular"
            style={styles.glassDisc}>
            <View style={styles.hit}>{renderPlainControl(item)}</View>
          </GlassView>
        ))}
      </GlassContainer>
    )
  }

  // Blur / web-adjacent fallback — still LiquidGlassChrome so verifiers and
  // older devices keep a single capsule.
  return (
    <LiquidGlassChrome
      interactive
      fallback="regular"
      contentLayout="flow"
      style={[styles.fallbackCapsule, {minWidth: width, width}]}>
      <View style={rowStyle}>{items.map(renderPlainSlot)}</View>
    </LiquidGlassChrome>
  )
}

function renderPlainSlot(item: ChromeGlassGroupItem) {
  return (
    <View key={item.accessibilityLabel} style={styles.hit}>
      {renderPlainControl(item)}
    </View>
  )
}

function renderPlainControl(item: ChromeGlassGroupItem) {
  if (item.kind === 'button') {
    return (
      <ModulaIconButton
        icon={item.icon}
        chrome="plain"
        accessibilityLabel={item.accessibilityLabel}
        onPress={item.onPress}
      />
    )
  }
  return (
    <ChromeIconMenu
      icon={item.icon ?? 'more'}
      chrome="plain"
      accessibilityLabel={item.accessibilityLabel}
      title={item.title}
      actions={item.actions}
      onAction={item.onAction}
    />
  )
}

const styles = StyleSheet.create({
  fallbackCapsule: {
    borderRadius: OVERLAY_GROUP_HIT / 2,
    flexGrow: 0,
    flexShrink: 0,
    height: OVERLAY_GROUP_HIT,
    minHeight: OVERLAY_GROUP_HIT,
    overflow: 'hidden',
  },
  glassDisc: {
    borderRadius: OVERLAY_GROUP_HIT / 2,
    flexGrow: 0,
    flexShrink: 0,
    height: OVERLAY_GROUP_HIT,
    overflow: 'visible',
    width: OVERLAY_GROUP_HIT,
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
