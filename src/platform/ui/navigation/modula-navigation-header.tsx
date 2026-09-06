import type {ReactNode} from 'react'
import {StyleSheet, View} from 'react-native'
import {useSafeAreaInsets} from 'react-native-safe-area-context'

import {ProgressiveBlurBand} from '@/components/materials/ProgressiveBlurBand'
import {AppText} from '@/components/primitives/AppText'
import {ModulaBackButton} from '@/platform/ui/buttons/modula-back-button'
import {
  ChromeGlassControlGroup,
  type ChromeGlassGroupItem,
  type ChromeGlassGroupMenu,
} from '@/platform/ui/menus/chrome-glass-control-group'
import {OVERLAY_GLASS_HIT, TOOLBAR_HIT} from '@/platform/ui/menus/toolbar-chrome'
import {
  CHROME_BLUR_INTENSITY,
  CHROME_FADE_EXTENSION,
  CHROME_HEADER_ROW,
} from '@/platform/ui/navigation/chrome-insets'
import {LAYERS} from '@/theme/tokens/layers'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type ModulaNavigationHeaderPresentation =
  | 'compact'
  | 'large-title'
  | 'transparent-over-hero'
  | 'scrolled'

export type ModulaNavigationHeaderProps = {
  title: string
  subtitle?: string
  presentation?: ModulaNavigationHeaderPresentation
  right?: ReactNode
  onBack?: () => void
  onShare?: () => void
  overflow?: Omit<ChromeGlassGroupMenu, 'kind'>
  items?: ChromeGlassGroupItem[]
  testID?: string
}

/** One secondary-route navigation chrome contract for shell and products. */
export function ModulaNavigationHeader({
  title,
  subtitle,
  presentation = 'compact',
  right,
  onBack,
  onShare,
  overflow,
  items,
  testID,
}: ModulaNavigationHeaderProps) {
  const insets = useSafeAreaInsets()
  const {spacing} = useThemeTokens()
  const large = presentation === 'large-title'
  const rowHeight = insets.top + CHROME_HEADER_ROW + (large ? 26 : 0)
  const blurHeight = rowHeight + CHROME_FADE_EXTENSION

  const trail = (() => {
    if (items?.length) return <ChromeGlassControlGroup items={items} />
    if (onShare && overflow) {
      return (
        <ChromeGlassControlGroup
          items={[
            {kind: 'button', icon: 'share', accessibilityLabel: 'Share', onPress: onShare},
            {kind: 'menu', ...overflow},
          ]}
        />
      )
    }
    if (overflow) {
      return (
        <ChromeGlassControlGroup
          items={[{kind: 'menu', ...overflow, icon: overflow.icon ?? 'more'}]}
        />
      )
    }
    if (onShare) {
      return (
        <ChromeGlassControlGroup
          items={[{kind: 'button', icon: 'share', accessibilityLabel: 'Share', onPress: onShare}]}
        />
      )
    }
    return right ?? <View style={styles.slotSpacer} />
  })()

  return (
    <>
      <View style={{height: rowHeight}} />
      <View
        pointerEvents="box-none"
        style={[styles.overlay, {height: blurHeight}]}
        testID={testID}>
        {presentation === 'transparent-over-hero' ? null : (
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <ProgressiveBlurBand
              height={blurHeight}
              intensity={CHROME_BLUR_INTENSITY}
              topHeavy
            />
          </View>
        )}
        <View
          style={[
            styles.row,
            {
              height: rowHeight,
              paddingHorizontal: spacing[3],
              paddingTop: insets.top,
            },
          ]}>
          <View style={styles.side}>
            <ModulaBackButton onPress={onBack} />
          </View>
          <View style={[styles.copy, large ? styles.copyLarge : null]}>
            <AppText
              accessibilityRole="header"
              numberOfLines={1}
              style={large ? styles.largeTitle : styles.title}
              variant={large ? 'title2' : 'headline'}>
              {title}
            </AppText>
            {subtitle ? (
              <AppText variant="caption" colour="textSecondary" numberOfLines={1}>
                {subtitle}
              </AppText>
            ) : null}
          </View>
          <View style={[styles.side, styles.sideEnd]}>{trail}</View>
        </View>
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  copy: {
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  copyLarge: {
    alignItems: 'flex-start',
    alignSelf: 'flex-end',
    paddingBottom: 6,
  },
  largeTitle: {
    fontWeight: '700',
  },
  overlay: {
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: LAYERS.sticky,
  },
  row: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    paddingBottom: 10,
    width: '100%',
    zIndex: 2,
  },
  side: {
    alignItems: 'flex-start',
    justifyContent: 'center',
    minWidth: OVERLAY_GLASS_HIT,
  },
  sideEnd: {
    alignItems: 'center',
    flexDirection: 'row',
    flexGrow: 0,
    flexShrink: 0,
    justifyContent: 'flex-end',
    minWidth: TOOLBAR_HIT,
  },
  slotSpacer: {
    height: TOOLBAR_HIT,
    width: TOOLBAR_HIT,
  },
  title: {
    textAlign: 'center',
  },
})
