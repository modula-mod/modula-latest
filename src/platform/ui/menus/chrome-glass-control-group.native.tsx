import type {ComponentType, ReactNode} from 'react'
import {StyleSheet, View, type StyleProp, type ViewStyle} from 'react-native'

import type {AppIconName} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {ModulaIconButton} from '@/platform/ui/buttons/modula-icon-button'
import {LiquidGlassChrome} from '@/platform/ui/materials/liquid-glass-chrome'
import {ChromeIconMenu} from '@/platform/ui/menus/chrome-icon-menu'
import {isCallstackLiquidGlassNativeAvailable} from '@/platform/ui/navigation/liquid-glass-availability'
import {
  OVERLAY_GROUP_ACTION_WIDTH,
  OVERLAY_GROUP_GAP,
  OVERLAY_GROUP_HIT,
  OVERLAY_GROUP_MIN_WIDTH,
  overlayGroupWidth,
  overlayGroupWidthForKinds,
  TOOLBAR_HIT,
} from '@/platform/ui/menus/toolbar-chrome'
import {HEADER_ICON_PAIR_GAP} from '@/platform/ui/navigation/plain-header-items'
import type {ModulaActionItem} from '@/platform/ui/menus/types'
import {useSystemAccessibility} from '@/theme/accessibility/useSystemAccessibility'
import {isNativeGlassRuntimeAvailable} from '@/theme/materials/nativeMaterial'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

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

/** Compact filled chip inside the same glass capsule (e.g. product Open). */
export type ChromeGlassGroupAction = {
  kind: 'action'
  label: string
  accessibilityLabel: string
  onPress: () => void
  disabled?: boolean
  tone?: 'product' | 'accent' | 'muted'
}

export type ChromeGlassGroupItem =
  | ChromeGlassGroupButton
  | ChromeGlassGroupMenu
  | ChromeGlassGroupAction

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

function resolvedWidth(items: ChromeGlassGroupItem[], actionReveal: number): number {
  const reveal = Math.min(1, Math.max(0, actionReveal))
  const leadingAction = items[0]?.kind === 'action'
  if (!leadingAction) {
    return overlayGroupWidthForKinds(items.map(item => (item.kind === 'action' ? 'action' : 'icon')))
  }
  const rest = items.slice(1).map(item => (item.kind === 'action' ? 'action' : 'icon') as 'action' | 'icon')
  const base = overlayGroupWidthForKinds(rest.length ? rest : ['icon'])
  return base + (OVERLAY_GROUP_ACTION_WIDTH + OVERLAY_GROUP_GAP) * reveal
}

/**
 * THE shared Home-style control group.
 *
 * One liquid-glass capsule. Plain 44pt glyphs inside with 22pt gap.
 * Leading `action` chips morph in via `actionReveal` (0–1) — no snap.
 */
export function ChromeGlassControlGroup({
  items,
  actionReveal = 1,
}: {
  items: ChromeGlassGroupItem[]
  /** Continuous 0–1 reveal for a leading `action` slot (smooth morph). */
  actionReveal?: number
}) {
  const {reduceTransparency} = useSystemAccessibility()
  const reveal = Math.min(1, Math.max(0, actionReveal))
  const width = resolvedWidth(items, reveal)
  const capsuleStyle: StyleProp<ViewStyle> = [
    styles.capsule,
    {minWidth: width, width},
  ]
  const content = (
    <View style={[styles.row, {minWidth: width, width}]}>
      {items.map((item, index) => (
        <GroupSlot
          key={item.accessibilityLabel}
          item={item}
          reveal={item.kind === 'action' && index === 0 ? reveal : 1}
          trailingGap={index < items.length - 1}
        />
      ))}
    </View>
  )

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

function GroupSlot({
  item,
  reveal,
  trailingGap,
}: {
  item: ChromeGlassGroupItem
  reveal: number
  trailingGap: boolean
}) {
  const {colours, radius} = useThemeTokens()

  if (item.kind === 'action') {
    const tone = item.tone ?? 'product'
    const fill =
      tone === 'muted'
        ? colours.surfaceMuted
        : tone === 'accent'
          ? colours.accent
          : colours.text
    const labelColour =
      tone === 'muted'
        ? colours.textTertiary
        : tone === 'accent'
          ? colours.accentForeground
          : colours.canvas
    const enabled = reveal > 0.55 && !item.disabled

    return (
      <View
        style={[
          styles.actionSlot,
          {
            marginRight: trailingGap ? OVERLAY_GROUP_GAP * reveal : 0,
            opacity: reveal,
            width: OVERLAY_GROUP_ACTION_WIDTH * reveal,
          },
        ]}>
        <View style={styles.actionHit}>
          <AppPressable
            accessibilityLabel={item.accessibilityLabel}
            accessibilityState={{disabled: !enabled}}
            disabled={!enabled}
            hitSlop={4}
            onPress={enabled ? item.onPress : undefined}
            style={[
              styles.actionChip,
              {
                backgroundColor: fill,
                borderRadius: radius.round,
                opacity: item.disabled ? 0.55 : 1,
                transform: [{scale: 0.88 + 0.12 * reveal}],
              },
            ]}>
            <AppText
              variant="buttonLabel"
              numberOfLines={1}
              style={{
                color: labelColour,
                fontSize: 13,
                fontWeight: '700',
                includeFontPadding: false,
                lineHeight: 15,
              }}>
              {item.label}
            </AppText>
          </AppPressable>
        </View>
      </View>
    )
  }

  return (
    <View style={[styles.hit, trailingGap ? styles.hitGap : null]}>
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
  actionChip: {
    alignItems: 'center',
    height: 26,
    justifyContent: 'center',
    minWidth: 48,
    paddingHorizontal: 10,
  },
  actionHit: {
    alignItems: 'center',
    height: OVERLAY_GROUP_HIT,
    justifyContent: 'center',
    width: OVERLAY_GROUP_ACTION_WIDTH,
  },
  actionSlot: {
    flexGrow: 0,
    flexShrink: 0,
    height: OVERLAY_GROUP_HIT,
    overflow: 'hidden',
  },
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
  hitGap: {
    marginRight: OVERLAY_GROUP_GAP,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    flexGrow: 0,
    flexShrink: 0,
    height: OVERLAY_GROUP_HIT,
    justifyContent: 'center',
  },
})
