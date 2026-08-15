import type {ReactNode} from 'react'
import {useMemo, useState} from 'react'
import {ScrollView, StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {AppText} from '@/components/primitives/AppText'
import {ModuleCatalogueCard} from '@/features/modules/components'
import {useModuleCatalogueQuery} from '@/features/modules/hooks'
import {isLegacyVaultNotesModuleId} from '@modula/greenfield-contracts'
import type {ModuleCatalogueItem, ProductHubCategory} from '@/data/repositories/contracts'
import {isInstalledModuleState} from '@/features/modules/identity/installPresentation'
import {ModulaButton} from '@/platform/ui/buttons/modula-button'
import {ModulaSearchField} from '@/platform/ui/controls/modula-search-field'
import {ModulaCurvedSectionTabs} from '@/platform/ui/tabs'
import {useFloatingTabBarContentPadding} from '@/platform/ui/navigation/floating-tab-bar-inset'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const CATEGORIES: ProductHubCategory[] = ['All', 'Productivity', 'Social', 'Creator']

export function ProductHubMarketplaceScreen() {
  return (
    <MarketplaceScaffold>
      <ProductHubMarketplaceContent />
    </MarketplaceScaffold>
  )
}

export function ProductHubMarketplaceContent({compact = false}: {compact?: boolean}) {
  const router = useRouter()
  const {spacing} = useThemeTokens()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<ProductHubCategory>('All')
  const catalogue = useModuleCatalogueQuery({q: query, category})
  const items = useMemo(
    () => (catalogue.data ?? []).filter(item => !isLegacyVaultNotesModuleId(item.moduleId)),
    [catalogue.data],
  )

  const featured = items.filter(item => item.featured).slice(0, compact ? 2 : 4)
  const madeByModula = items.filter(item => item.publisherName === 'Modula' || item.publisherId === 'modula')
  const available = items.filter(item => item.installable && !isInstalledModuleState(item.installationState))
  const yours = items.filter(item => isInstalledModuleState(item.installationState))
  const coming = items.filter(item => item.installationState === 'comingSoon' || item.priceState === 'Coming soon')

  const openModule = (moduleId: string) => {
    router.push(`/marketplace/${encodeURIComponent(moduleId)}` as Href)
  }

  return (
    <View style={{gap: spacing[5]}}>
      <ModulaSearchField
        value={query}
        onChangeText={setQuery}
        placeholder="Search"
        accessibilityLabel="Search Product Hub"
      />

      <ModulaCurvedSectionTabs
        tabs={CATEGORIES.map(label => ({id: label, label}))}
        selectedId={category}
        onSelect={id => setCategory(id as ProductHubCategory)}
      />

      {catalogue.isPending ? (
        <AppText variant="caption" colour="textSecondary">
          Loading catalogue.
        </AppText>
      ) : null}

      {featured.length ? (
        <CatalogueSection title="Featured" items={featured} onOpen={openModule} featured />
      ) : null}
      {available.length ? (
        <CatalogueSection title="New for Modula" items={available} onOpen={openModule} />
      ) : null}
      {madeByModula.length ? (
        <CatalogueSection title="Made by Modula" items={madeByModula} onOpen={openModule} />
      ) : null}
      {yours.length ? <CatalogueSection title="Your modules" items={yours} onOpen={openModule} /> : null}
      {coming.length ? <CatalogueSection title="Coming soon" items={coming} onOpen={openModule} /> : null}

      {!catalogue.isPending && items.length === 0 ? (
        <View style={{gap: spacing[2]}}>
          <AppText variant="headline">Nothing matches</AppText>
          <AppText variant="caption" colour="textSecondary">
            Try another search, or browse Made by Modula.
          </AppText>
          <ModulaButton
            label="Clear search"
            role="secondary"
            onPress={() => {
              setQuery('')
              setCategory('All')
            }}
          />
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
  featured = false,
}: {
  title: string
  items: ModuleCatalogueItem[]
  onOpen: (moduleId: string) => void
  featured?: boolean
}) {
  const {spacing} = useThemeTokens()
  if (!items.length) return null
  return (
    <View style={{gap: spacing[2]}}>
      <AppText variant="headline">{title}</AppText>
      {items.map(item => (
        <ModuleCatalogueCard
          key={`${title}-${item.moduleId}`}
          item={item}
          featured={featured}
          onPress={() => onOpen(item.moduleId)}
        />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  content: {padding: 16},
  screen: {flex: 1},
})
