import {useCallback, useEffect, useMemo, useReducer, useRef} from 'react'
import {ScrollView, StyleSheet, View, useWindowDimensions} from 'react-native'
import {useRouter, type Href} from 'expo-router'
import {useSafeAreaInsets} from 'react-native-safe-area-context'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {Avatar} from '@/components/primitives/Avatar'
import {useSession} from '@/auth/runtime'
import type {ModuleCatalogueItem, ProductHubCategory} from '@/data/repositories/contracts'
import {isLegacyVaultNotesModuleId} from '@modula/greenfield-contracts'
import {ProductHubSearchChrome} from '@/features/modules/components/ProductHubSearchChrome'
import {
  HubSectionHeader,
  ModuleCategoryTile,
  ModuleCollection,
  ModuleEditorialHero,
  ModuleRow,
  ModuleShelf,
  PRODUCT_HUB_BROWSE_CATEGORIES,
  PRODUCT_HUB_COLLECTIONS,
} from '@/features/modules/components/presentation'
import {useModuleCatalogueQuery} from '@/features/modules/hooks'
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
  const {colours, spacing} = useThemeTokens()
  const tabPadding = useFloatingTabBarContentPadding()
  const [search, dispatch] = useReducer(reduceProductHubSearch, initialProductHubSearch)
  const catalogue = useModuleCatalogueQuery({
    q: '',
    category: 'All',
  })
  const scrollRef = useRef<ScrollView>(null)
  const restored = useRef(false)
  const wide = width >= 960
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
  const madeByModula = items.filter(item => item.publisherName === 'Modula' || item.publisherId === 'modula')
  const available = items.filter(item => item.installable && !isInstalledModuleState(item.installationState))
  const yours = items.filter(item => isInstalledModuleState(item.installationState))
  const updates = items.filter(item => item.installationState === 'updateAvailable')

  const openModule = (moduleId: string) => {
    rememberProductHubOffset(consumeProductHubOffset())
    router.push(`/marketplace/${encodeURIComponent(moduleId)}` as Href)
  }

  const openInstall = (moduleId: string) => {
    rememberProductHubOffset(consumeProductHubOffset())
    router.push(`/marketplace/${encodeURIComponent(moduleId)}?install=1` as Href)
  }

  const onAction = (item: ModuleCatalogueItem) => {
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
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <View
        style={[
          styles.chrome,
          {
            paddingTop: insets.top + spacing[2],
            paddingHorizontal: spacing[4],
            zIndex: LAYERS.sticky,
            backgroundColor: colours.canvas,
          },
        ]}>
        <View style={styles.titleRow}>
          <AppText variant={search.compact && !searchActive ? 'headline' : 'display'}>Product Hub</AppText>
          <View style={styles.titleActions}>
            {search.compact || searchActive ? (
              <ProductHubSearchChrome
                model={search}
                compact={search.compact && !searchActive}
                onTrigger={() => dispatch({type: 'TAP_SEARCH'})}
                onChangeText={text => dispatch({type: 'TYPE', query: text})}
                onCancel={() => dispatch({type: 'CANCEL'})}
                onSettled={onSettled}
              />
            ) : null}
            <AppPressable
              accessibilityLabel="Open profile"
              onPress={() => router.push('/profile' as Href)}>
              <Avatar name={profileName} uri={profileUri} size={32} />
            </AppPressable>
          </View>
        </View>
        {!search.compact && !searchActive ? (
          <View style={{gap: spacing[3], paddingBottom: spacing[3]}}>
            <AppText variant="body" colour="textSecondary">
              Discover modules built for Modula.
            </AppText>
            <ProductHubSearchChrome
              model={search}
              compact={false}
              onTrigger={() => dispatch({type: 'TAP_SEARCH'})}
              onChangeText={text => dispatch({type: 'TYPE', query: text})}
              onCancel={() => dispatch({type: 'CANCEL'})}
              onSettled={onSettled}
            />
          </View>
        ) : null}
      </View>

      <ResponsiveContent maxWidth={wide ? 1100 : 860}>
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
            <EditorialLanding
              featured={featured}
              available={available}
              madeByModula={madeByModula}
              yours={yours}
              updates={updates}
              items={items}
              pending={catalogue.isPending}
              wide={wide}
              onOpen={openModule}
              onAction={onAction}
            />
          )}
        </ScrollView>
      </ResponsiveContent>
    </View>
  )
}

function EditorialLanding({
  featured,
  available,
  madeByModula,
  yours,
  updates,
  items,
  pending,
  wide,
  onOpen,
  onAction,
}: {
  featured?: ModuleCatalogueItem
  available: ModuleCatalogueItem[]
  madeByModula: ModuleCatalogueItem[]
  yours: ModuleCatalogueItem[]
  updates: ModuleCatalogueItem[]
  items: ModuleCatalogueItem[]
  pending: boolean
  wide: boolean
  onOpen: (moduleId: string) => void
  onAction: (item: ModuleCatalogueItem) => void
}) {
  const {spacing} = useThemeTokens()
  if (pending) {
    return (
      <AppText variant="caption" colour="textSecondary">
        Loading catalogue.
      </AppText>
    )
  }
  return (
    <View style={[styles.landing, wide ? styles.landingWide : null, {gap: spacing[6]}]}>
      {featured ? (
        <SectionEnter delay={0}>
          <View style={{gap: spacing[2]}}>
            <HubSectionHeader title="FEATURED" icon="sparkles" eyebrow />
            <ModuleEditorialHero
              item={featured}
              onPress={() => onOpen(featured.moduleId)}
              onAction={() => onAction(featured)}
            />
          </View>
        </SectionEnter>
      ) : null}

      {available.length ? (
        <SectionEnter delay={40}>
          <View>
            <HubSectionHeader title="New for Modula" icon="download" />
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
        <ModuleShelf title="Made by Modula" items={madeByModula} onOpen={onOpen} icon="modules" />
      </SectionEnter>

      {PRODUCT_HUB_COLLECTIONS.map((collection, index) => {
        const members = items.filter(item => collection.moduleIds.includes(item.moduleId))
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

      {yours.length ? (
        <SectionEnter delay={200}>
          <View>
            <HubSectionHeader title="Your modules" icon="check" />
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
          icon="update"
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
        {pending ? <AppText variant="caption" colour="textSecondary">Searching…</AppText> : null}
        {error ? (
          <AppText variant="body" colour="destructive">
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
          <AppText variant="body" colour="textSecondary">
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
        <HubSectionHeader title="Browse" icon="search" />
        <View style={styles.tiles}>
          {PRODUCT_HUB_BROWSE_CATEGORIES.map(category => (
            <ModuleCategoryTile key={category} category={category} onPress={() => onBrowse(category)} />
          ))}
        </View>
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
  chrome: {width: '100%'},
  content: {paddingHorizontal: 16, paddingTop: 8},
  landing: {width: '100%'},
  landingWide: {alignSelf: 'center', maxWidth: 1100, width: '100%'},
  screen: {flex: 1},
  tiles: {flexDirection: 'row', flexWrap: 'wrap', gap: 12},
  titleActions: {alignItems: 'center', flexDirection: 'row', gap: 12},
  titleRow: {alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: 44},
})
