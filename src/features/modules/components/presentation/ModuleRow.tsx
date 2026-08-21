import {StyleSheet, View} from 'react-native'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import type {ModuleCatalogueItem} from '@/data/repositories/contracts'
import {ModuleArtwork} from '@/features/modules/components/ModuleArtwork'
import {ModuleAction} from '@/features/modules/components/presentation/ModuleAction'
import {resolveModuleInstallPresentation} from '@/features/modules/identity/installPresentation'
import {productCopyFor} from '@/features/modules/identity/productCopy'
import {moduleIdentitySubtext} from '@/features/modules/identity/moduleIdentitySubtext'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function ModuleRow({
  item,
  onPress,
  onAction,
  showSeparator = true,
}: {
  item: ModuleCatalogueItem
  onPress: () => void
  onAction?: () => void
  showSeparator?: boolean
}) {
  const {colours, spacing} = useThemeTokens()
  const presentation = resolveModuleInstallPresentation(item)
  const copy = productCopyFor(item.moduleId, item.name, item.description)
  return (
    <View>
      <View style={[styles.row, {gap: spacing[3], paddingVertical: spacing[3]}]}>
        <AppPressable
          accessibilityLabel={`Open ${copy.name}`}
          onPress={onPress}
          style={styles.identity}>
          <ModuleArtwork moduleId={item.moduleId} name={copy.name} size={56} variant="icon" />
          <View style={styles.flex}>
            <AppText variant="label" numberOfLines={1}>
              {copy.name}
            </AppText>
            <AppText variant="micro" colour="textTertiary" numberOfLines={1}>
              {moduleIdentitySubtext(item.moduleId, item.latestVersion, {compact: true})}
            </AppText>
            <AppText variant="caption" colour="textSecondary" numberOfLines={1}>
              {copy.short}
            </AppText>
            <AppText variant="micro" colour="textTertiary" numberOfLines={1}>
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
    minHeight: 56,
    minWidth: 0,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 72,
    width: '100%',
  },
  rule: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 68,
  },
})
