import {StyleSheet, View} from 'react-native'

import {AppIcon} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import type {ModuleCatalogueItem} from '@/data/repositories/contracts'
import {ModuleStatusPill} from '@/features/modules/components/ModuleStatusPill'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function ModuleCatalogueCard({item, onPress}: {item: ModuleCatalogueItem; onPress: () => void}) {
  const {colours, radius, spacing} = useThemeTokens()
  const statusPills = catalogueStatusPills(item)
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
        <View style={[styles.icon, {backgroundColor: colours.accentSubtle, borderRadius: radius.medium}]}>
          <AppIcon name={item.kind === 'system' ? 'security' : 'modules'} colour={colours.accent} />
        </View>
        <View style={styles.flex}>
          <AppText variant="label" numberOfLines={1}>{item.name}</AppText>
          <AppText variant="caption" colour="textSecondary" numberOfLines={1}>{item.publisherName}</AppText>
        </View>
      </View>
      <AppText variant="caption" colour="textSecondary" numberOfLines={3}>{item.description}</AppText>
      <View style={[styles.wrap, {gap: spacing[2]}]}>
        {statusPills.map(state => (
          <ModuleStatusPill key={state} state={state} />
        ))}
      </View>
      <AppText variant="micro" colour="textTertiary">
        {item.category} · {item.trustLevel} · {item.latestVersion ? `v${item.latestVersion}` : item.compatibility}
      </AppText>
      {item.standard?.standardVersion ? (
        <AppText variant="micro" colour="textTertiary">
          Standard {item.standard.standardVersion} · {runtimeSupportSummary(item)} · {item.standard.registries.apis} APIs
        </AppText>
      ) : null}
    </AppPressable>
  )
}

function catalogueStatusPills(item: ModuleCatalogueItem): string[] {
  const states = [item.installationState, item.priceState]
  const labels = new Set<string>()
  return states.filter(state => {
    const label = String(state).toLowerCase().replace(/[_\s-]+/g, '')
    if (label === 'notavailable' && item.installationState === 'notAvailable') return false
    if (label === 'comingsoon' && item.installationState === 'comingSoon') return false
    if (labels.has(label)) return false
    labels.add(label)
    return true
  })
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    flexBasis: '47%',
    flexGrow: 1,
    minHeight: 168,
    minWidth: 170,
  },
  flex: {flex: 1, minWidth: 0},
  header: {alignItems: 'center', flexDirection: 'row', gap: 12},
  icon: {alignItems: 'center', height: 44, justifyContent: 'center', width: 44},
  wrap: {flexDirection: 'row', flexWrap: 'wrap'},
})

function runtimeSupportSummary(item: ModuleCatalogueItem): string {
  const sections = Object.values(item.standard?.runtimeSupport?.sections ?? {})
  if (!sections.length) return `${item.standard?.registries.services ?? 0} services`
  const supported = sections.filter(state => state === 'SUPPORTED').length
  const partial = sections.filter(state => state === 'PARTIALLY_SUPPORTED').length
  const declarative = sections.filter(state => state === 'DECLARATIVE_ONLY').length
  return `${supported} supported · ${partial} partial · ${declarative} declarative`
}
