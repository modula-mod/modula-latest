import {StyleSheet, View} from 'react-native'

import {AppIcon} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import type {ModuleCatalogueItem} from '@/data/repositories/contracts'
import {ModulaButton} from '@/platform/ui/buttons/modula-button'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function ModuleCatalogueCard({
  item,
  onPress,
  onAction,
}: {
  item: ModuleCatalogueItem
  onPress: () => void
  onAction?: () => void
}) {
  const {colours, radius, spacing} = useThemeTokens()
  const installed = ['installed', 'enabled', 'disabled', 'updateAvailable', 'configurationRequired'].includes(
    item.installationState,
  )
  const actionLabel = installed ? 'Open' : item.installable ? 'Install' : item.priceState === 'Coming soon' ? 'Soon' : 'View'
  return (
    <AppPressable
      accessibilityLabel={`Open ${item.name}`}
      onPress={onPress}
      style={[
        styles.card,
        {
          backgroundColor: item.featured ? colours.surfaceRaised : colours.surface,
          borderColor: item.featured ? colours.accentBorder : colours.border,
          borderRadius: radius.large,
          gap: spacing[3],
          padding: spacing[4],
        },
      ]}>
      <View style={styles.header}>
        <View style={[styles.art, {backgroundColor: colours.accentSubtle, borderRadius: radius.medium}]}>
          <AppIcon name={item.kind === 'system' ? 'security' : 'modules'} colour={colours.accent} size={26} />
        </View>
        <View style={styles.flex}>
          <AppText variant="label" numberOfLines={1}>{item.name}</AppText>
          <AppText variant="caption" colour="textSecondary" numberOfLines={1}>
            by {item.publisherName}
          </AppText>
        </View>
      </View>
      <AppText variant="caption" colour="textSecondary" numberOfLines={3}>{item.description}</AppText>
      <View style={[styles.footer, {gap: spacing[2]}]}>
        <View style={{flex: 1, gap: 2}}>
          <AppText variant="caption" colour="textSecondary">
            {installed ? 'Installed' : item.installable ? 'Available' : item.priceState}
          </AppText>
          <AppText variant="micro" colour="textTertiary">{item.priceState === 'Coming soon' ? 'Coming soon' : 'Free'}</AppText>
        </View>
        <ModulaButton
          label={actionLabel}
          role={installed ? 'secondary' : 'primary'}
          accessibilityLabel={`${actionLabel} ${item.name}`}
          onPress={onAction ?? onPress}
        />
      </View>
    </AppPressable>
  )
}

const styles = StyleSheet.create({
  art: {alignItems: 'center', height: 52, justifyContent: 'center', width: 52},
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    flexBasis: '47%',
    flexGrow: 1,
    minHeight: 176,
    minWidth: 170,
  },
  flex: {flex: 1, minWidth: 0},
  footer: {alignItems: 'center', flexDirection: 'row'},
  header: {alignItems: 'center', flexDirection: 'row', gap: 12},
})
