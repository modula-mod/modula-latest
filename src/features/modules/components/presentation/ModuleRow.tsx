import {StyleSheet, View, useWindowDimensions} from 'react-native'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import type {ModuleCatalogueItem} from '@/data/repositories/contracts'
import {ModuleArtwork} from '@/features/modules/components/ModuleArtwork'
import {ModuleAction} from '@/features/modules/components/presentation/ModuleAction'
import {resolveModuleInstallPresentation} from '@/features/modules/identity/installPresentation'
import {productCopyFor} from '@/features/modules/identity/productCopy'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function ModuleRow({
  item,
  onPress,
  onAction,
  showSeparator = true,
  muted = false,
}: {
  item: ModuleCatalogueItem
  onPress: () => void
  onAction?: () => void
  showSeparator?: boolean
  muted?: boolean
}) {
  const {colours, controls, spacing} = useThemeTokens()
  const {fontScale} = useWindowDimensions()
  const presentation = resolveModuleInstallPresentation(item)
  const copy = productCopyFor(item.moduleId, item.name, item.description)
  const stacked = fontScale >= 1.2
  const comingSoon = presentation.primaryAction === 'Soon'
  const quiet = muted || comingSoon

  return (
    <View testID={quiet ? 'coming-soon-row' : 'module-row'}>
      <View
        style={[
          styles.row,
          stacked ? styles.stacked : null,
          {
            gap: spacing[3],
            minHeight: controls.listRow.minimum,
            paddingVertical: spacing[2],
          },
        ]}>
        <AppPressable
          accessibilityLabel={`Open ${copy.name}`}
          onPress={onPress}
          style={styles.identity}>
          <ModuleArtwork moduleId={item.moduleId} name={copy.name} size={48} variant="icon" />
          <View style={styles.flex}>
            <AppText variant="productName" numberOfLines={stacked ? 2 : 1}>
              {copy.name}
            </AppText>
            <AppText variant="productSubtitle" colour="textSecondary" numberOfLines={stacked ? 2 : 1}>
              {copy.short}
            </AppText>
            <AppText variant="publisher" colour="textTertiary" numberOfLines={1}>
              {copy.publisher}
            </AppText>
          </View>
        </AppPressable>
        <ModuleAction
          presentation={presentation}
          productName={copy.name}
          onPress={onAction ?? onPress}
        />
      </View>
      {showSeparator ? <View style={[styles.rule, {backgroundColor: colours.separator}]} /> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  flex: {flex: 1, gap: 2, minWidth: 0},
  identity: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 12,
    minWidth: 0,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    width: '100%',
  },
  rule: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 60,
  },
  stacked: {
    alignItems: 'flex-start',
    flexDirection: 'column',
  },
})
