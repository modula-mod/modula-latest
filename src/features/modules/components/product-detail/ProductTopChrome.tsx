import {StyleSheet, View} from 'react-native'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import type {ModuleInstallPresentation} from '@/features/modules/identity/installPresentation'
import {ModulaBackButton} from '@/platform/ui/buttons/modula-back-button'
import {ModulaIconButton} from '@/platform/ui/buttons/modula-icon-button'
import {LiquidGlassChrome} from '@/platform/ui/materials/liquid-glass-chrome'
import {ChromeIconMenu} from '@/platform/ui/menus/chrome-icon-menu'
import {
  OVERLAY_GROUP_GAP,
  OVERLAY_GROUP_HIT,
} from '@/platform/ui/menus/toolbar-chrome'
import type {ModulaActionItem} from '@/platform/ui/menus/types'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

/** Compact primary label slot inside the trailing glass capsule. */
export const PRODUCT_PRIMARY_SLOT_WIDTH = 64

export function productTrailingCapsuleWidth(includePrimary: boolean): number {
  const icons = OVERLAY_GROUP_HIT * 2 + OVERLAY_GROUP_GAP
  return includePrimary ? icons + PRODUCT_PRIMARY_SLOT_WIDTH + OVERLAY_GROUP_GAP : icons
}

/**
 * Fixed overlay chrome — back never moves. Trailing share/more live in one
 * liquid-glass capsule; the primary action (Open / Install / …) morphs into
 * that same capsule as the sticky header appears.
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
  /** Sticky morph progress (0–1). Primary joins the trailing capsule when > 0. */
  progress?: number
  presentation: ModuleInstallPresentation
  onBack: () => void
  onPrimary: () => void
  onShare: () => void
  actions: ModulaActionItem[]
  onAction: (id: string) => void
}) {
  const {colours} = useThemeTokens()
  const primaryProgress = Math.min(1, Math.max(0, (progress - 0.12) / 0.4))
  const showPrimary = primaryProgress > 0.02
  const label = primaryLabel(presentation)
  const soon = presentation.primaryAction === 'Soon'
  const blocked = presentation.primaryAction === 'Can’t install on this device'
  const disabled =
    soon || blocked || (!presentation.installable && presentation.primaryAction === 'Install')

  const iconsWidth = OVERLAY_GROUP_HIT * 2 + OVERLAY_GROUP_GAP
  const primaryWidth = (PRODUCT_PRIMARY_SLOT_WIDTH + OVERLAY_GROUP_GAP) * primaryProgress
  const capsuleWidth = iconsWidth + primaryWidth

  return (
    <View pointerEvents="box-none" style={[styles.chrome, {top}]} testID="product-fixed-chrome">
      <ModulaBackButton accessibilityLabel="Back" chrome="glass" onPress={onBack} />
      <LiquidGlassChrome
        contentLayout="flow"
        fallback="regular"
        interactive
        style={[styles.capsule, {minWidth: capsuleWidth, width: capsuleWidth}]}>
        <View style={[styles.row, {minWidth: capsuleWidth, width: capsuleWidth}]}>
          {showPrimary ? (
            <View
              style={[
                styles.primarySlot,
                {
                  opacity: primaryProgress,
                  width: PRODUCT_PRIMARY_SLOT_WIDTH * primaryProgress,
                },
              ]}>
              <AppPressable
                accessibilityLabel={
                  soon ? `${productName} coming soon` : `${label} ${productName}`
                }
                accessibilityState={{disabled}}
                disabled={disabled || primaryProgress < 0.55}
                hitSlop={4}
                onPress={disabled ? undefined : onPrimary}
                style={styles.primaryHit}
                testID="product-sticky-primary">
                <AppText
                  variant="buttonLabel"
                  numberOfLines={1}
                  style={{color: colours.text, fontSize: 15, fontWeight: '700'}}>
                  {label}
                </AppText>
              </AppPressable>
            </View>
          ) : null}
          <View style={styles.hit}>
            <ModulaIconButton
              icon="share"
              chrome="plain"
              accessibilityLabel={`Share ${productName}`}
              onPress={onShare}
            />
          </View>
          <View style={styles.hit}>
            <ChromeIconMenu
              icon="more"
              chrome="plain"
              accessibilityLabel="More actions"
              title={productName}
              actions={actions}
              onAction={onAction}
            />
          </View>
        </View>
      </LiquidGlassChrome>
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
  capsule: {
    borderRadius: OVERLAY_GROUP_HIT / 2,
    flexGrow: 0,
    flexShrink: 0,
    height: OVERLAY_GROUP_HIT,
    minHeight: OVERLAY_GROUP_HIT,
    overflow: 'hidden',
  },
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
  hit: {
    alignItems: 'center',
    flexGrow: 0,
    flexShrink: 0,
    height: OVERLAY_GROUP_HIT,
    justifyContent: 'center',
    width: OVERLAY_GROUP_HIT,
  },
  primaryHit: {
    alignItems: 'center',
    height: OVERLAY_GROUP_HIT,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  primarySlot: {
    alignItems: 'center',
    height: OVERLAY_GROUP_HIT,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    flexGrow: 0,
    flexShrink: 0,
    gap: OVERLAY_GROUP_GAP,
    height: OVERLAY_GROUP_HIT,
    justifyContent: 'flex-end',
    paddingLeft: 2,
  },
})
