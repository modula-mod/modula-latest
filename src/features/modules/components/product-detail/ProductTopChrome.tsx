import {StyleSheet, View} from 'react-native'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import type {ModuleInstallPresentation} from '@/features/modules/identity/installPresentation'
import {ModulaBackButton} from '@/platform/ui/buttons/modula-back-button'
import {ChromeGlassControlGroup} from '@/platform/ui/menus/chrome-glass-control-group'
import {
  OVERLAY_GROUP_GAP,
  OVERLAY_GROUP_HIT,
  OVERLAY_GROUP_MIN_WIDTH,
} from '@/platform/ui/menus/toolbar-chrome'
import type {ModulaActionItem} from '@/platform/ui/menus/types'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

/** Compact filled primary chip next to the Product Hub–sized control group. */
const PRIMARY_CHIP_WIDTH = 58

export function productTrailingCapsuleWidth(includePrimary: boolean): number {
  return includePrimary
    ? OVERLAY_GROUP_MIN_WIDTH + OVERLAY_GROUP_GAP + PRIMARY_CHIP_WIDTH
    : OVERLAY_GROUP_MIN_WIDTH
}

/**
 * Fixed overlay chrome — back never moves.
 * Trailing share/more uses the same {@link ChromeGlassControlGroup} as Product Hub.
 * Primary (Open) morphs in as a compact chip beside that group — no stretched capsule.
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
  /** Sticky morph progress (0–1). Primary chip appears beside the control group. */
  progress?: number
  presentation: ModuleInstallPresentation
  onBack: () => void
  onPrimary: () => void
  onShare: () => void
  actions: ModulaActionItem[]
  onAction: (id: string) => void
}) {
  const {colours, radius} = useThemeTokens()
  const primaryProgress = Math.min(1, Math.max(0, (progress - 0.12) / 0.4))
  const showPrimary = primaryProgress > 0.15
  const label = primaryLabel(presentation)
  const soon = presentation.primaryAction === 'Soon'
  const blocked = presentation.primaryAction === 'Can’t install on this device'
  const disabled =
    soon || blocked || (!presentation.installable && presentation.primaryAction === 'Install')
  const accentPrimary = label === 'Install' || label === 'Update'
  const buttonFill = soon
    ? colours.surfaceMuted
    : accentPrimary
      ? colours.accent
      : colours.text
  const buttonLabel = soon
    ? colours.textTertiary
    : accentPrimary
      ? colours.accentForeground
      : colours.canvas

  return (
    <View pointerEvents="box-none" style={[styles.chrome, {top}]} testID="product-fixed-chrome">
      <ModulaBackButton accessibilityLabel="Back" chrome="glass" onPress={onBack} />
      <View style={styles.trailing}>
        {showPrimary ? (
          <AppPressable
            accessibilityLabel={
              soon ? `${productName} coming soon` : `${label} ${productName}`
            }
            accessibilityState={{disabled}}
            disabled={disabled || primaryProgress < 0.55}
            hitSlop={4}
            onPress={disabled ? undefined : onPrimary}
            style={[
              styles.primaryChip,
              {
                backgroundColor: buttonFill,
                borderRadius: radius.round,
                opacity: primaryProgress,
                transform: [{scale: 0.92 + 0.08 * primaryProgress}],
              },
            ]}
            testID="product-sticky-primary">
            <AppText
              variant="buttonLabel"
              numberOfLines={1}
              style={{
                color: buttonLabel,
                fontSize: 13,
                fontWeight: '700',
                includeFontPadding: false,
                lineHeight: 15,
              }}>
              {label}
            </AppText>
          </AppPressable>
        ) : null}
        <ChromeGlassControlGroup
          items={[
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
          ]}
        />
      </View>
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
  primaryChip: {
    alignItems: 'center',
    flexGrow: 0,
    flexShrink: 0,
    height: 28,
    justifyContent: 'center',
    minWidth: PRIMARY_CHIP_WIDTH,
    paddingHorizontal: 12,
  },
  trailing: {
    alignItems: 'center',
    flexDirection: 'row',
    flexGrow: 0,
    flexShrink: 0,
    gap: OVERLAY_GROUP_GAP,
    height: OVERLAY_GROUP_HIT,
  },
})
