import {StyleSheet, View} from 'react-native'

import type {ModuleInstallPresentation} from '@/features/modules/identity/installPresentation'
import {ModulaBackButton} from '@/platform/ui/buttons/modula-back-button'
import {
  ChromeGlassControlGroup,
  type ChromeGlassGroupItem,
} from '@/platform/ui/menus/chrome-glass-control-group'
import {
  OVERLAY_GROUP_GAP,
  OVERLAY_GROUP_MIN_WIDTH,
  overlayGroupWidthForKinds,
} from '@/platform/ui/menus/toolbar-chrome'
import type {ModulaActionItem} from '@/platform/ui/menus/types'

export function productTrailingCapsuleWidth(includePrimary: boolean): number {
  return includePrimary
    ? overlayGroupWidthForKinds(['action', 'icon', 'icon'])
    : OVERLAY_GROUP_MIN_WIDTH
}

/**
 * Fixed overlay chrome — back never moves.
 * Share/more always use {@link ChromeGlassControlGroup} (Product Hub capsule).
 * As sticky progress rises, Open morphs into that same glass group as an action chip.
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
  /** Sticky morph progress (0–1). Primary joins the control group when high. */
  progress?: number
  presentation: ModuleInstallPresentation
  onBack: () => void
  onPrimary: () => void
  onShare: () => void
  actions: ModulaActionItem[]
  onAction: (id: string) => void
}) {
  const includePrimary = progress > 0.45
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
    ...(includePrimary
      ? [
          {
            kind: 'action' as const,
            label,
            accessibilityLabel: soon
              ? `${productName} coming soon`
              : `${label} ${productName}`,
            onPress: onPrimary,
            disabled,
            tone,
          },
        ]
      : []),
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
      <ChromeGlassControlGroup items={trailItems} />
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
