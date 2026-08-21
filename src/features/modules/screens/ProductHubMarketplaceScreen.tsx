import {useCallback, useEffect, useMemo, useReducer, useRef, useState} from 'react'
import {ScrollView, StyleSheet, View, useWindowDimensions} from 'react-native'
import {useRouter, type Href} from 'expo-router'
import {useSafeAreaInsets} from 'react-native-safe-area-context'

import {AppText} from '@/components/primitives/AppText'
import {useSession} from '@/auth/runtime'
import type {ModuleCatalogueItem, ProductHubCategory} from '@/data/repositories/contracts'
import {isLegacyVaultNotesModuleId} from '@modula/greenfield-contracts'
import {ProductHubHeader} from '@/features/modules/components/ProductHubHeader'
import {type ProductHubSegment} from '@/features/modules/components/ProductHubSegmentedControl'
import {
  ComingSoonEditorial,
  ComingSoonRow,
  HubSectionHeader,
  ModuleBrowseGrid,
  ModuleCollection,
  ModuleEditorialHero,
  ModuleIconShelf,
  ModuleRow,
  PRODUCT_HUB_COLLECTIONS,
} from '@/features/modules/components/presentation'
import {useModuleCatalogueQuery} from '@/features/modules/hooks'
import {marketplaceCanvas} from '@/features/modules/identity/marketplaceCanvas'
import {isInstalledModuleState, resolveModuleInstallPresentation} from '@/features/modules/identity/installPresentation'
import {productCopyFor} from '@/features/modules/identity/productCopy'
import {
  initialProductHubSearch,
  isProductHubSearchActive,
  reduceProductHubSearch,
} from '@/features/modules/state/productHubSearchMachine'
import {
  consumeProductHubOffset,
  rememberProductHubOffset,
} from '@/features/modules/state/productHubScroll'
import {selectionHaptic} from '@/lib/haptics'
import {PageIntro} from '@/platform/ui/chrome/page-intro'
import {SectionEnter} from '@/platform/ui/motion/section-enter'
import {useFloatingTabBarContentPadding} from '@/platform/ui/navigation/floating-tab-bar-inset'
import {LAYERS} from '@/theme/tokens/layers'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const COMPACT_ON = 56
const COMPACT_OFF = 28

export function ProductHubMarketplaceScreen() {
  return <ProductHubMarketplaceContent />
}

export function ProductHubMarketplaceContent({compact: _compact = false}: {compact?: boolean}) {
  const router = useRouter()
  const session = useSession()
  const insets = useSafeAreaInsets()
  const {width} = useWindowDimensions()
  const {colours, spacing, resolvedColourMode} = useThemeTokens()
  const canvas = marketplaceCanvas(resolvedColourMode, colours.canvas)
  const tabPadding = useFloatingTabBarContentPadding()
  const [search, dispatch] = useReducer(reduceProductHubSearch, initialProductHubSearch)
  const [segment, setSegment] = useState<ProductHubSegment>('discover')
  const catalogue = useModuleCatalogueQuery({
    q: '',
    category: 'All',
  })
  const scrollRef = useRef<ScrollView>(null)
  const restored = useRef(false)
  const wide = width >= 960
  const desktop = width >= 1100
  const searchActive = isProductHubSearchActive(search.state)

  useEffect(() => {
    if (restored.current) return
    restored.current = true
    const y = consumeProductHubOffset()
    if (y > 0) {
      requestAnimationFrame(() => scrollRef.current?.scrollTo({y, animated: false}))
    }
  }, [])

  const items = useMemo(
    () => (catalogue.data ?? []).filter(item => !isLegacyVaultNotesModuleId(item.moduleId)),
    [catalogue.data],
  )

  const featured = items.find(item => item.featured) ?? items.find(item => item.installable) ?? items[0]
  const featuredId = featured?.moduleId
  const madeByModula = items.filter(
    item =>
      item.moduleId !== featuredId &&
      (item.publisherName === 'Modula' || item.publisherId === 'modula'),
  )
  const available = items.filter(
    item =>
      item.installable &&
      !isInstalledModuleState(item.installationState) &&
      item.moduleId !== featuredId &&
      resolveModuleInstallPresentation(item).primaryAction !== 'Soon',
  )
  const comingSoon = items.filter(
    item => item.moduleId !== featuredId && resolveModuleInstallPresentation(item).primaryAction === 'Soon',
  )
  const yours = items.filter(item => isInstalledModuleState(item.installationState))
  const updates = items.filter(item => item.installationState === 'updateAvailable')
  const yoursOnDiscover = yours.filter(item => item.moduleId !== featuredId)

  const openModule = (moduleId: string) => {
    rememberProductHubOffset(consumeProductHubOffset())
    router.push(`/marketplace/${encodeURIComponent(moduleId)}` as Href)
  }

  const openInstall = (moduleId: string) => {
    rememberProductHubOffset(consumeProductHubOffset())
    router.push(`/marketplace/${encodeURIComponent(moduleId)}?install=1` as Href)
  }

  const onAction = (item: ModuleCatalogueItem) => {
    void selectionHaptic()
    const presentation = resolveModuleInstallPresentation(item)
    if (presentation.primaryAction === 'Open') {
      router.push(`/module/${encodeURIComponent(item.moduleId)}` as Href)
      return
    }
    if (presentation.primaryAction === 'Install' || presentation.primaryAction === 'Update') {
      openInstall(item.moduleId)
      return
    }
    openModule(item.moduleId)
  }

  const profileName =
    session.status === 'signedIn' || session.status === 'refreshing' ? session.profile.displayName : 'Account'
  const profileUri =
    session.status === 'signedIn' || session.status === 'refreshing' ? session.profile.avatarUri : undefined

  const onSettled = useCallback(() => {
    if (search.state === 'SEARCH_EXPANDING') dispatch({type: 'GEOMETRY_SETTLED'})
    if (search.state === 'SEARCH_COLLAPSING') dispatch({type: 'COLLAPSE_COMPLETE'})
  }, [search.state])

  const suggested = items.slice(0, 3)
  const results = search.query.trim()
    ? items.filter(item => matchesQuery(item, search.query))
    : []

  useEffect(() => {
    if (!search.query.trim()) return
    dispatch({type: 'RESULTS_CHANGED', count: results.length, error: catalogue.isError})
  }, [catalogue.isError, results.length, search.query])

  return (
    <View style={[styles.screen, {backgroundColor: canvas}]}>
      <View
        style={{
          paddingTop: insets.top + spacing[2],
          zIndex: LAYERS.sticky,
          backgroundColor: canvas,
        }}>
        <ProductHubHeader
          compact={search.compact}
          search={search}
          profileName={profileName}
          profileUri={profileUri}
          segment={segment}
          onSegmentChange={next => {
            void selectionHaptic()
            setSegment(next)
          }}
          updatesDisabled={!updates.length}
          wide={wide}
          onSearchTrigger={() => dispatch({type: 'TAP_SEARCH'})}
          onSearchChange={text => dispatch({type: 'TYPE', query: text})}
          onSearchCancel={() => dispatch({type: 'CANCEL'})}
          onSearchSettled={onSettled}
          onProfilePress={() => router.push('/profile' as Href)}
        />
      </View>

      <ResponsiveContent maxWidth={desktop ? 1180 : wide ? 860 : 860}>
        <ScrollView
          ref={scrollRef}
          onScroll={event => {
            const y = event.nativeEvent.contentOffset.y
            rememberProductHubOffset(y)
            const compact = search.compact ? y > COMPACT_OFF : y > COMPACT_ON
            dispatch({type: 'SCROLL', compact})
          }}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          contentContainerStyle={[
            styles.content,
            {gap: spacing[6], paddingBottom: tabPadding + spacing[6]},
          ]}>
          {searchActive ? (
            <SearchMode
              query={search.query}
              suggested={suggested}
              results={results}
              pending={catalogue.isPending}
              error={catalogue.isError}
              onOpen={openModule}
              onAction={onAction}
              onBrowse={category => dispatch({type: 'TYPE', query: category})}
            />
          ) : (
            <>
              {segment === 'installed' ? (
                <InstalledMode
                  yours={yours}
                  pending={catalogue.isPending}
                  onOpen={openModule}
                  onAction={onAction}
                />
              ) : null}
              {segment === 'updates' ? (
                <UpdatesMode
                  updates={updates}
                  pending={catalogue.isPending}
                  onOpen={openModule}
                  onAction={onAction}
                />
              ) : null}
              {segment === 'discover' ? (
                <EditorialLanding
                  featured={featured}
                  available={available}
                  comingSoon={comingSoon}
                  madeByModula={madeByModula}
                  yours={yoursOnDiscover}
                  updates={updates}
                  items={items}
                  featuredId={featuredId}
                  pending={catalogue.isPending}
                  wide={wide}
                  desktop={desktop}
                  onOpen={openModule}
                  onAction={onAction}
                  onBrowse={category => {
                    dispatch({type: 'TAP_SEARCH'})
                    dispatch({type: 'TYPE', query: category})
                  }}
                />
              ) : null}
            </>
          )}
        </ScrollView>
      </ResponsiveContent>
    </View>
  )
}

function EditorialLanding({
  featured,
  available,
  comingSoon,
  madeByModula,
  yours,
  updates,
  items,
  featuredId,
  pending,
  wide,
  desktop,
  onOpen,
  onAction,
  onBrowse,
}: {
  featured?: ModuleCatalogueItem
  available: ModuleCatalogueItem[]
  comingSoon: ModuleCatalogueItem[]
  madeByModula: ModuleCatalogueItem[]
  yours: ModuleCatalogueItem[]
  updates: ModuleCatalogueItem[]
  items: ModuleCatalogueItem[]
  featuredId?: string
  pending: boolean
  wide: boolean
  desktop: boolean
  onOpen: (moduleId: string) => void
  onAction: (item: ModuleCatalogueItem) => void
  onBrowse: (category: ProductHubCategory) => void
}) {
  const {spacing} = useThemeTokens()
  if (pending) {
    return (
      <AppText variant="caption" colour="textSecondary">
        Loading catalogue.
      </AppText>
    )
  }
  const comingSoonLead = comingSoon[0]
  const comingSoonRest = comingSoon.slice(1)
  const lists = (
    <>
      {available.length ? (
        <SectionEnter delay={40}>
          <View testID="product-hub-new-for-modula" style={desktop ? styles.desktopColumn : undefined}>
            <HubSectionHeader
              title="New for Modula"
              subtitle="Fresh tools for your digital world"
              trailing="See All"
            />
            {available.map((item, index) => (
              <ModuleRow
                key={`new-${item.moduleId}`}
                item={item}
                onPress={() => onOpen(item.moduleId)}
                onAction={() => onAction(item)}
                showSeparator={index < available.length - 1}
              />
            ))}
          </View>
        </SectionEnter>
      ) : null}

      <SectionEnter delay={80}>
        <View testID="product-hub-made-by-modula" style={desktop ? styles.desktopColumn : undefined}>
          <ModuleIconShelf
            title="Made by Modula"
            subtitle="Essential modules"
            items={madeByModula}
            onOpen={onOpen}
          />
        </View>
      </SectionEnter>
    </>
  )

  return (
    <View style={[styles.landing, wide ? styles.landingWide : null, {gap: spacing[8]}]}>
      {featured ? (
        <SectionEnter delay={0}>
          <View testID="product-hub-featured">
            <ModuleEditorialHero
              item={featured}
              href={`/marketplace/${encodeURIComponent(featured.moduleId)}`}
              onPress={() => onOpen(featured.moduleId)}
              onAction={() => onAction(featured)}
            />
          </View>
        </SectionEnter>
      ) : null}

      {desktop ? <View style={styles.desktopSplit}>{lists}</View> : lists}

      {comingSoonLead ? (
        <SectionEnter delay={60}>
          <View testID="product-hub-coming-soon">
            <HubSectionHeader title="Coming to Modula" subtitle="Intentionally upcoming" />
            <ComingSoonEditorial item={comingSoonLead} onPress={() => onOpen(comingSoonLead.moduleId)} />
            {comingSoonRest.map((item, index) => (
              <ComingSoonRow
                key={`soon-${item.moduleId}`}
                item={item}
                onPress={() => onOpen(item.moduleId)}
                showSeparator={index < comingSoonRest.length - 1}
              />
            ))}
          </View>
        </SectionEnter>
      ) : null}

      {PRODUCT_HUB_COLLECTIONS.map((collection, index) => {
        const members = items.filter(
          item => collection.moduleIds.includes(item.moduleId) && item.moduleId !== featuredId,
        )
        return (
          <SectionEnter key={collection.id} delay={120 + index * 40}>
            <ModuleCollection
              title={collection.title}
              subtitle={collection.subtitle}
              items={members}
              onOpen={onOpen}
              onAction={onAction}
            />
          </SectionEnter>
        )
      })}

      <SectionEnter delay={180}>
        <View testID="product-hub-browse">
          <HubSectionHeader title="Browse" trailing="See All" />
          <ModuleBrowseGrid onBrowse={onBrowse} />
        </View>
      </SectionEnter>

      {yours.length ? (
        <SectionEnter delay={200}>
          <View testID="product-hub-your-modules">
            <HubSectionHeader title="Your modules" />
            {yours.map((item, index) => (
              <ModuleRow
                key={`yours-${item.moduleId}`}
                item={item}
                onPress={() => onOpen(item.moduleId)}
                onAction={() => onAction(item)}
                showSeparator={index < yours.length - 1}
              />
            ))}
          </View>
        </SectionEnter>
      ) : null}

      {updates.length ? (
        <HubSectionHeader
          title="Updates"
          subtitle={`${updates.length} update${updates.length === 1 ? '' : 's'} available`}
        />
      ) : null}

      {!items.length ? (
        <PageIntro
          eyebrow="Product Hub"
          icon="modules"
          title="Nothing here yet"
          body="Modules you can install will appear here."
        />
      ) : null}
    </View>
  )
}

function InstalledMode({
  yours,
  pending,
  onOpen,
  onAction,
}: {
  yours: ModuleCatalogueItem[]
  pending: boolean
  onOpen: (moduleId: string) => void
  onAction: (item: ModuleCatalogueItem) => void
}) {
  if (pending) {
    return (
      <AppText variant="caption" colour="textSecondary">
        Loading catalogue.
      </AppText>
    )
  }
  if (!yours.length) {
    return (
      <PageIntro
        eyebrow="Installed"
        icon="modules"
        title="No modules installed"
        body="Modules you install will appear here."
      />
    )
  }
  return (
    <View testID="product-hub-installed">
      {yours.map((item, index) => (
        <ModuleRow
          key={`installed-${item.moduleId}`}
          item={item}
          onPress={() => onOpen(item.moduleId)}
          onAction={() => onAction(item)}
          showSeparator={index < yours.length - 1}
        />
      ))}
    </View>
  )
}

function UpdatesMode({
  updates,
  pending,
  onOpen,
  onAction,
}: {
  updates: ModuleCatalogueItem[]
  pending: boolean
  onOpen: (moduleId: string) => void
  onAction: (item: ModuleCatalogueItem) => void
}) {
  if (pending) {
    return (
      <AppText variant="caption" colour="textSecondary">
        Loading catalogue.
      </AppText>
    )
  }
  if (!updates.length) {
    return (
      <PageIntro
        eyebrow="Updates"
        icon="update"
        title="You’re up to date"
        body="When a module has an update, it will appear here."
      />
    )
  }
  return (
    <View testID="product-hub-updates">
      {updates.map((item, index) => (
        <ModuleRow
          key={`update-${item.moduleId}`}
          item={item}
          onPress={() => onOpen(item.moduleId)}
          onAction={() => onAction(item)}
          showSeparator={index < updates.length - 1}
        />
      ))}
    </View>
  )
}

function SearchMode({
  query,
  suggested,
  results,
  pending,
  error,
  onOpen,
  onAction,
  onBrowse,
}: {
  query: string
  suggested: ModuleCatalogueItem[]
  results: ModuleCatalogueItem[]
  pending: boolean
  error: boolean
  onOpen: (moduleId: string) => void
  onAction: (item: ModuleCatalogueItem) => void
  onBrowse: (category: ProductHubCategory) => void
}) {
  const {spacing} = useThemeTokens()
  if (query.trim()) {
    const modules = results.filter(item => item.kind === 'module' || !item.kind)
    const tools = results.filter(item => item.kind === 'tool')
    return (
      <View style={{gap: spacing[5]}} testID="product-hub-search-results">
        <AppText variant="caption" colour="textTertiary">
          “{query}”
        </AppText>
        {pending ? (
          <AppText variant="caption" colour="textSecondary" testID="product-hub-search-loading">
            Searching…
          </AppText>
        ) : null}
        {error ? (
          <AppText variant="body" colour="destructive" testID="product-hub-search-error">
            Product Hub search couldn&apos;t load. Try again.
          </AppText>
        ) : null}
        {modules.length ? (
          <View>
            <HubSectionHeader title="Modules" icon="modules" eyebrow />
            {modules.map((item, index) => (
              <ModuleRow
                key={`result-${item.moduleId}`}
                item={item}
                onPress={() => onOpen(item.moduleId)}
                onAction={() => onAction(item)}
                showSeparator={index < modules.length - 1}
              />
            ))}
          </View>
        ) : null}
        {tools.length ? (
          <View>
            <HubSectionHeader title="Tools" icon="tools" eyebrow />
            {tools.map((item, index) => (
              <ModuleRow
                key={`tool-${item.moduleId}`}
                item={item}
                onPress={() => onOpen(item.moduleId)}
                onAction={() => onAction(item)}
                showSeparator={index < tools.length - 1}
              />
            ))}
          </View>
        ) : null}
        {!pending && !error && !results.length ? (
          <AppText variant="body" colour="textSecondary" testID="product-hub-search-empty">
            No matching modules or tools.
          </AppText>
        ) : null}
      </View>
    )
  }

  return (
    <View style={{gap: spacing[5]}} testID="product-hub-search-browse">
      <View>
        <HubSectionHeader title="Suggested" icon="sparkles" />
        {suggested.map((item, index) => (
          <ModuleRow
            key={`suggested-${item.moduleId}`}
            item={item}
            onPress={() => onOpen(item.moduleId)}
            onAction={() => onAction(item)}
            showSeparator={index < suggested.length - 1}
          />
        ))}
      </View>
      <View style={{gap: spacing[3]}}>
        <HubSectionHeader title="Browse" trailing="See All" />
        <ModuleBrowseGrid onBrowse={onBrowse} />
      </View>
    </View>
  )
}

function matchesQuery(item: ModuleCatalogueItem, query: string): boolean {
  const copy = productCopyFor(item.moduleId, item.name, item.description)
  const haystack = `${copy.name} ${copy.short} ${copy.description} ${item.publisherName} ${item.category}`.toLowerCase()
  return haystack.includes(query.trim().toLowerCase())
}

const styles = StyleSheet.create({
  content: {paddingHorizontal: 16, paddingTop: 8},
  desktopColumn: {flex: 1, minWidth: 280},
  desktopSplit: {flexDirection: 'row', flexWrap: 'wrap', gap: 32, width: '100%'},
  landing: {width: '100%'},
  landingWide: {alignSelf: 'center', maxWidth: 1180, width: '100%'},
  screen: {flex: 1},
})
