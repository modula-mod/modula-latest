import {StyleSheet, View} from 'react-native'

import type {ModuleInstallPresentation} from '@/features/modules/identity/installPresentation'
import {ModulaBackButton} from '@/platform/ui/buttons/modula-back-button'
import {
  ChromeGlassControlGroup,
  type ChromeGlassGroupItem,
} from '@/platform/ui/menus/chrome-glass-control-group'
import {
  OVERLAY_GROUP_ACTION_WIDTH,
  OVERLAY_GROUP_GAP,
  OVERLAY_GROUP_MIN_WIDTH,
} from '@/platform/ui/menus/toolbar-chrome'
import type {ModulaActionItem} from '@/platform/ui/menus/types'

/** Continuous trailing width while Open morphs into the control group. */
export function productTrailingCapsuleWidth(actionReveal: number): number {
  const reveal = Math.min(1, Math.max(0, actionReveal))
  return OVERLAY_GROUP_MIN_WIDTH + (OVERLAY_GROUP_ACTION_WIDTH + OVERLAY_GROUP_GAP) * reveal
}

export function productActionReveal(progress: number): number {
  return Math.min(1, Math.max(0, (progress - 0.08) / 0.55))
}

/**
 * Fixed overlay chrome — back never moves.
 * Share/more + Open live in one {@link ChromeGlassControlGroup}; Open morphs
 * in smoothly via `actionReveal` (no snap).
 */
export function ProductFixedChrome({
  productName,
  top,
  progress = 0,
  presentation,
  onBack,
  onPrimary,
  onShare,
  actions,
  onAction,
}: {
  productName: string
  top: number
  progress?: number
  presentation: ModuleInstallPresentation
  onBack: () => void
  onPrimary: () => void
  onShare: () => void
  actions: ModulaActionItem[]
  onAction: (id: string) => void
}) {
  const reveal = productActionReveal(progress)
  const label = primaryLabel(presentation)
  const soon = presentation.primaryAction === 'Soon'
  const blocked = presentation.primaryAction === 'Can’t install on this device'
  const disabled =
    soon || blocked || (!presentation.installable && presentation.primaryAction === 'Install')
  const tone =
    label === 'Install' || label === 'Update'
      ? ('accent' as const)
      : soon
        ? ('muted' as const)
        : ('product' as const)

  const trailItems: ChromeGlassGroupItem[] = [
    {
      kind: 'action',
      label,
      accessibilityLabel: soon ? `${productName} coming soon` : `${label} ${productName}`,
      onPress: onPrimary,
      disabled,
      tone,
    },
    {
      kind: 'button',
      icon: 'share',
      accessibilityLabel: `Share ${productName}`,
      onPress: onShare,
    },
    {
      kind: 'menu',
      accessibilityLabel: 'More actions',
      title: productName,
      actions,
      onAction,
    },
  ]

  return (
    <View pointerEvents="box-none" style={[styles.chrome, {top}]} testID="product-fixed-chrome">
      <ModulaBackButton accessibilityLabel="Back" chrome="glass" onPress={onBack} />
      <ChromeGlassControlGroup actionReveal={reveal} items={trailItems} />
    </View>
  )
}

function primaryLabel(presentation: ModuleInstallPresentation): string {
  const label = presentation.primaryAction
  if (label === 'Soon') return 'Soon'
  if (label === 'Can’t install on this device') return 'N/A'
  return label
}

/** @deprecated Use {@link ProductFixedChrome} — kept for existing imports. */
export const ProductTopChrome = ProductFixedChrome

const styles = StyleSheet.create({
  chrome: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: OVERLAY_GROUP_GAP,
    justifyContent: 'space-between',
    left: 12,
    position: 'absolute',
    right: 12,
    zIndex: 6,
  },
})
