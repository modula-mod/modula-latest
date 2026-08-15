import {StyleSheet, View} from 'react-native'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import type {ModuleCatalogueItem} from '@/data/repositories/contracts'
import {ModuleArtwork} from '@/features/modules/components/ModuleArtwork'
import {resolveModuleInstallPresentation} from '@/features/modules/identity/installPresentation'
import {ModulaButton} from '@/platform/ui/buttons/modula-button'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function ModuleCatalogueCard({
  item,
  onPress,
  onAction,
  featured = false,
}: {
  item: ModuleCatalogueItem
  onPress: () => void
  onAction?: () => void
  featured?: boolean
}) {
  const {spacing} = useThemeTokens()
  const presentation = resolveModuleInstallPresentation(item)
  const actionLabel = presentation.primaryAction
  return (
    <AppPressable
      accessibilityLabel={`Open ${item.name}`}
      onPress={onPress}
      style={[styles.row, {gap: spacing[3], paddingVertical: spacing[3]}]}>
      <ModuleArtwork
        moduleId={item.moduleId}
        name={item.name}
        size={featured ? 88 : 64}
        variant={featured ? 'hero' : 'icon'}
      />
      <View style={styles.flex}>
        <AppText variant={featured ? 'headline' : 'label'} numberOfLines={1}>
          {item.name}
        </AppText>
        <AppText variant="caption" colour="textSecondary" numberOfLines={2}>
          {item.description || `by ${item.publisherName}`}
        </AppText>
        <AppText variant="micro" colour="textTertiary">
          {presentation.customerStatus}
        </AppText>
      </View>
      <ModulaButton
        label={actionLabel === 'Can’t install on this device' ? 'View' : actionLabel}
        role={presentation.primaryAction === 'Install' ? 'primary' : 'secondary'}
        accessibilityLabel={`${actionLabel} ${item.name}`}
        onPress={onAction ?? onPress}
      />
    </AppPressable>
  )
}

const styles = StyleSheet.create({
  flex: {flex: 1, minWidth: 0, gap: 2},
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 72,
    width: '100%',
  },
})
