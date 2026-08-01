import type {ReactNode} from 'react'
import {useMemo, useState} from 'react'
import {ScrollView, StyleSheet, TextInput, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {AppIcon} from '@/components/primitives/AppIcon'
import {AppText} from '@/components/primitives/AppText'
import {ModuleCatalogueCard} from '@/features/modules/components'
import {useInstalledModulesQuery, useModuleCatalogueQuery} from '@/features/modules/hooks'
import type {
  ModuleCatalogueItem,
  ProductHubCategory,
  ProductHubExtensionKind,
} from '@/data/repositories/contracts'
import {ModulaButton} from '@/platform/ui/buttons/modula-button'
import {ModulaCurvedSectionTabs} from '@/platform/ui/tabs'
import {useFloatingTabBarContentPadding} from '@/platform/ui/navigation/floating-tab-bar-inset'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const CATEGORIES: ProductHubCategory[] = [
  'All',
  'Productivity',
  'Social',
  'Creator',
  'Media',
  'Automation',
  'AI',
  'Developer',
  'First-party',
  'Installed',
  'Compatible',
]

const KIND_SECTIONS: {title: string; kind?: ProductHubExtensionKind; filter?: (item: ModuleCatalogueItem) => boolean}[] = [
  {title: 'Modules', kind: 'module'},
  {title: 'Tools', kind: 'tool'},
  {title: 'Functions', kind: 'function'},
  {title: 'Plugins', kind: 'plugin'},
  {title: 'Connections', kind: 'connector'},
  {title: 'Widgets', kind: 'widget'},
  {title: 'Installed', filter: item => ['installed', 'enabled', 'disabled', 'updateAvailable', 'configurationRequired'].includes(item.installationState)},
  {title: 'Updates', filter: item => item.installationState === 'updateAvailable'},
  {title: 'Coming Soon', filter: item => item.installationState === 'comingSoon' || item.priceState === 'Coming soon'},
  {title: 'Developer', filter: item => item.category === 'Developer' || item.kind === 'system'},
]

export function ProductHubMarketplaceScreen() {
  return (
    <MarketplaceScaffold>
      <ProductHubMarketplaceContent />
    </MarketplaceScaffold>
  )
}

export function ProductHubMarketplaceContent({compact = false}: {compact?: boolean}) {
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<ProductHubCategory>('All')
  const catalogue = useModuleCatalogueQuery({q: query, category})
  const installed = useInstalledModulesQuery()
  const items = useMemo(() => catalogue.data ?? [], [catalogue.data])
  const featured = items.filter(item => item.featured).slice(0, compact ? 3 : 6)
  const installedCount = installed.data?.length ?? 0
  const standard20Count = items.filter(item => item.standard?.standardVersion === '2.0.0').length
  const serviceCount = items.reduce((total, item) => total + (item.standard?.registries.services ?? 0), 0)
  const apiCount = items.reduce((total, item) => total + (item.standard?.registries.apis ?? 0), 0)
  const runtimeSupportedCount = items.reduce(
    (total, item) => total + Object.values(item.standard?.runtimeSupport?.sections ?? {}).filter(state => state === 'SUPPORTED').length,
    0,
  )
  const runtimeDeclarativeCount = items.reduce(
    (total, item) => total + Object.values(item.standard?.runtimeSupport?.sections ?? {}).filter(state => state === 'DECLARATIVE_ONLY').length,
    0,
  )

  const sections = useMemo(
    () =>
      KIND_SECTIONS.map(section => ({
        title: section.title,
        items: items.filter(item => section.kind ? item.kind === section.kind : section.filter?.(item)),
      })).filter(section => section.items.length > 0 || !query),
    [items, query],
  )

  const openModule = (moduleId: string) => {
    router.push(`/marketplace/${encodeURIComponent(moduleId)}` as Href)
  }

  return (
    <View style={{gap: spacing[5]}}>
      <View style={{gap: spacing[2]}}>
        <AppText variant="headline">Product Hub</AppText>
        <AppText variant="body" colour="textSecondary">
          Registry-backed modules, tools, functions, plugins, widgets and connectors. DIMON commercial distribution is represented as inactive metadata only.
        </AppText>
      </View>

      <View
        style={[
          styles.search,
          {
            backgroundColor: colours.surface,
            borderColor: colours.border,
            borderRadius: radius.round,
            paddingHorizontal: spacing[3],
          },
        ]}>
        <AppIcon name="search" colour={colours.textTertiary} size={18} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search registry"
          placeholderTextColor={colours.textTertiary}
          accessibilityLabel="Search Product Hub"
          returnKeyType="search"
          style={[styles.searchInput, {color: colours.text}]}
        />
      </View>

      <ModulaCurvedSectionTabs
        tabs={CATEGORIES.map(label => ({id: label, label}))}
        selectedId={category}
        onSelect={id => setCategory(id as ProductHubCategory)}
      />

      <View style={[styles.summaryRow, {gap: spacing[2]}]}>
        <SummaryChip label="Installed" value={String(installedCount)} />
        <SummaryChip label="Compatible" value={String(items.filter(item => item.installable).length)} />
        <SummaryChip label="Updates" value={String(items.filter(item => item.installationState === 'updateAvailable').length)} />
        <SummaryChip label="Standard 2.0" value={String(standard20Count)} />
        <SummaryChip label="Runtime supported" value={String(runtimeSupportedCount)} />
        <SummaryChip label="Declarative only" value={String(runtimeDeclarativeCount)} />
        <SummaryChip label="Services" value={String(serviceCount)} />
        <SummaryChip label="APIs" value={String(apiCount)} />
      </View>

      {catalogue.isPending ? (
        <AppText variant="caption" colour="textSecondary">Loading catalogue.</AppText>
      ) : null}

      {featured.length ? (
        <CatalogueSection title="Featured" items={featured} onOpen={openModule} horizontal />
      ) : null}

      {sections.map(section => (
        <CatalogueSection
          key={section.title}
          title={section.title}
          items={section.items}
          onOpen={openModule}
          emptyLabel={`No ${section.title.toLowerCase()} currently match this view.`}
        />
      ))}

      {!catalogue.isPending && items.length === 0 ? (
        <View style={[styles.empty, {backgroundColor: colours.surface, borderColor: colours.border, borderRadius: radius.large, padding: spacing[4], gap: spacing[2]}]}>
          <AppText variant="headline">No registry results</AppText>
          <AppText variant="caption" colour="textSecondary">
            Installed modules continue to run from local registry metadata when GitHub is unavailable.
          </AppText>
          <ModulaButton label="Clear search" role="secondary" onPress={() => { setQuery(''); setCategory('All') }} />
        </View>
      ) : null}
    </View>
  )
}

function MarketplaceScaffold({children}: {children: ReactNode}) {
  const {colours, spacing} = useThemeTokens()
  const tabPadding = useFloatingTabBarContentPadding()
  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title="Product Hub" />
      <ResponsiveContent maxWidth={860}>
        <ScrollView
          contentContainerStyle={[styles.content, {gap: spacing[5], paddingBottom: tabPadding}]}
          keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      </ResponsiveContent>
    </View>
  )
}

function CatalogueSection({
  title,
  items,
  onOpen,
  emptyLabel,
  horizontal = false,
}: {
  title: string
  items: ModuleCatalogueItem[]
  onOpen: (moduleId: string) => void
  emptyLabel?: string
  horizontal?: boolean
}) {
  const {spacing} = useThemeTokens()
  if (!items.length && !emptyLabel) return null
  return (
    <View style={{gap: spacing[3]}}>
      <AppText variant="headline">{title}</AppText>
      {items.length ? (
        horizontal ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap: spacing[3]}}>
            {items.map(item => (
              <View key={`${title}-${item.moduleId}`} style={styles.railItem}>
                <ModuleCatalogueCard item={item} onPress={() => onOpen(item.moduleId)} />
              </View>
            ))}
          </ScrollView>
        ) : (
          <View style={[styles.grid, {gap: spacing[3]}]}>
            {items.map(item => (
              <ModuleCatalogueCard key={`${title}-${item.moduleId}`} item={item} onPress={() => onOpen(item.moduleId)} />
            ))}
          </View>
        )
      ) : (
        <AppText variant="caption" colour="textSecondary">{emptyLabel}</AppText>
      )}
    </View>
  )
}

function SummaryChip({label, value}: {label: string; value: string}) {
  const {colours, radius, spacing} = useThemeTokens()
  return (
    <View
      style={[
        styles.chip,
        {
          backgroundColor: colours.surfaceRaised,
          borderColor: colours.border,
          borderRadius: radius.round,
          paddingHorizontal: spacing[3],
          paddingVertical: spacing[2],
        },
      ]}>
      <AppText variant="micro" colour="textTertiary">{label}</AppText>
      <AppText variant="label">{value}</AppText>
    </View>
  )
}

const styles = StyleSheet.create({
  chip: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 8,
    minHeight: 36,
  },
  content: {padding: 16},
  empty: {borderWidth: StyleSheet.hairlineWidth},
  grid: {flexDirection: 'row', flexWrap: 'wrap'},
  railItem: {width: 260},
  screen: {flex: 1},
  search: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 8,
    minHeight: 46,
  },
  searchInput: {flex: 1, minHeight: 44},
  summaryRow: {flexDirection: 'row', flexWrap: 'wrap'},
})
