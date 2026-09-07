import {StyleSheet, Text, View} from 'react-native'

import {ProgressiveBlurBand} from '@/components/materials/ProgressiveBlurBand'
import {ModuleArtwork} from '@/features/modules/components/ModuleArtwork'
import type {ModuleInstallPresentation} from '@/features/modules/identity/installPresentation'
import {LiquidGlassChrome} from '@/platform/ui/materials/liquid-glass-chrome'
import {
  ChromeGlassControlGroup,
  type ChromeGlassGroupItem,
} from '@/platform/ui/menus/chrome-glass-control-group'
import {
  OVERLAY_GROUP_ACTION_WIDTH,
  OVERLAY_GROUP_GAP,
  OVERLAY_GROUP_HIT,
  OVERLAY_GROUP_MIN_WIDTH,
} from '@/platform/ui/menus/toolbar-chrome'
import type {ModulaActionItem} from '@/platform/ui/menus/types'
import {
  CHROME_BLUR_INTENSITY,
  CHROME_FADE_EXTENSION,
} from '@/platform/ui/navigation/chrome-insets'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const IDENTITY_ICON = 26

/** Continuous trailing width while Open morphs into the control group. */
export function productTrailingCapsuleWidth(actionReveal: number): number {
  const reveal = Math.min(1, Math.max(0, actionReveal))
  return OVERLAY_GROUP_MIN_WIDTH + (OVERLAY_GROUP_ACTION_WIDTH + OVERLAY_GROUP_GAP) * reveal
}

/** Sticky progress shared by the identity, blur and primary action. */
export function productActionReveal(progress: number): number {
  return Math.min(1, Math.max(0, progress))
}

/**
 * One product navigation row. Back, identity and trailing actions share the
 * same 44pt geometry, safe-area origin and regular liquid-glass material.
 */
export function ProductNavigationChrome({
  moduleId,
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
  moduleId?: string
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
  const {colours, spacing} = useThemeTokens()
  const reveal = productActionReveal(progress)
  const blurHeight = top + OVERLAY_GROUP_HIT + CHROME_FADE_EXTENSION
  const label = primaryLabel(presentation)
  const soon = presentation.primaryAction === 'Soon'
  const blocked = presentation.primaryAction === 'Can’t install on this device'
  const disabled =
    soon || blocked || (!presentation.installable && presentation.primaryAction === 'Install')
  const tone =
    label === 'Get' || label === 'Update'
      ? ('accent' as const)
      : soon
        ? ('muted' as const)
        : ('product' as const)

  const backItems: ChromeGlassGroupItem[] = [
    {
      kind: 'button',
      icon: 'back',
      accessibilityLabel: 'Back',
      onPress: onBack,
    },
  ]
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
    <View
      pointerEvents="box-none"
      style={[styles.shell, {height: blurHeight}]}
      testID="product-navigation-chrome">
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, {opacity: reveal}]}>
        <ProgressiveBlurBand
          height={blurHeight}
          intensity={CHROME_BLUR_INTENSITY}
          strength="normal"
          topHeavy
        />
      </View>

      <View
        pointerEvents="box-none"
        style={[styles.row, {gap: spacing[1], height: OVERLAY_GROUP_HIT, top}]}
        testID="product-navigation-row">
        <View testID="product-navigation-back">
          <ChromeGlassControlGroup items={backItems} />
        </View>

        <View style={styles.identitySlot}>
          <View
            pointerEvents="none"
            style={[styles.identityReveal, {opacity: reveal}]}
            testID="product-navigation-identity">
            <LiquidGlassChrome
              contentLayout="flow"
              fallback="regular"
              interactive={false}
              style={[styles.identityCapsule, {paddingHorizontal: 10}]}>
              <View style={styles.identityInner}>
                {moduleId ? (
                  <View style={styles.iconSlot}>
                    <ModuleArtwork
                      moduleId={moduleId}
                      name={productName}
                      size={IDENTITY_ICON}
                      variant="icon"
                    />
                  </View>
                ) : null}
                <Text numberOfLines={1} style={[styles.title, {color: colours.text}]}>
                  {productName}
                </Text>
              </View>
            </LiquidGlassChrome>
          </View>
        </View>

        <View testID="product-navigation-actions">
          <ChromeGlassControlGroup actionReveal={reveal} items={trailItems} />
        </View>
      </View>
    </View>
  )
}

function primaryLabel(presentation: ModuleInstallPresentation): string {
  const label = presentation.primaryAction
  if (label === 'Soon') return 'Soon'
  if (label === 'Can’t install on this device') return 'N/A'
  if (label === 'Install') return 'Get'
  return label
}

/** @deprecated Use {@link ProductNavigationChrome}. */
export const ProductFixedChrome = ProductNavigationChrome

/** @deprecated Use {@link ProductNavigationChrome}. */
export const ProductTopChrome = ProductNavigationChrome

const styles = StyleSheet.create({
  iconSlot: {
    alignItems: 'center',
    height: IDENTITY_ICON,
    justifyContent: 'center',
    width: IDENTITY_ICON,
  },
  identityCapsule: {
    borderRadius: OVERLAY_GROUP_HIT / 2,
    flexShrink: 1,
    height: OVERLAY_GROUP_HIT,
    justifyContent: 'center',
    maxWidth: '100%',
    minHeight: OVERLAY_GROUP_HIT,
  },
  identityInner: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 1,
    gap: 8,
    height: OVERLAY_GROUP_HIT,
    minWidth: 0,
  },
  identityReveal: {
    alignItems: 'flex-start',
    flexShrink: 1,
    maxWidth: '100%',
  },
  identitySlot: {
    alignItems: 'flex-start',
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    left: 12,
    position: 'absolute',
    right: 12,
  },
  shell: {
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 6,
  },
  title: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '600',
    includeFontPadding: false,
    letterSpacing: -0.2,
    lineHeight: 18,
    minWidth: 0,
    paddingBottom: 1,
  },
})
