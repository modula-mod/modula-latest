import {useCallback, useMemo, useReducer, useRef} from 'react'
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
  ModuleCategoryTile,
  ModuleCollection,
  ModuleEditorialHero,
  ModuleRow,
  ModuleShelf,
  PRODUCT_HUB_BROWSE_CATEGORIES,
  PRODUCT_HUB_COLLECTIONS,
} from '@/features/modules/components/presentation'
import {useModuleCatalogueQuery} from '@/features/modules/hooks'
import {isInstalledModuleState} from '@/features/modules/identity/installPresentation'
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
import {useFloatingTabBarContentPadding} from '@/platform/ui/navigation/floating-tab-bar-inset'
import {LAYERS} from '@/theme/tokens/layers'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const COMPACT_AT = 48

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
    q: isProductHubSearchActive(search.state) ? search.query : '',
    category: 'All',
  })
  const scrollRef = useRef<ScrollView>(null)
  const wide = width >= 960
  const searchActive = isProductHubSearchActive(search.state)

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
              Extend your Modula.
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
          contentOffset={{x: 0, y: consumeProductHubOffset()}}
          onScroll={event => {
            const y = event.nativeEvent.contentOffset.y
            rememberProductHubOffset(y)
            dispatch({type: 'SCROLL', compact: y > COMPACT_AT})
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
              onOpen={openModule}
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
        <View style={{gap: spacing[2]}}>
          <AppText variant="micro" colour="textTertiary">
            FEATURED
          </AppText>
          <ModuleEditorialHero item={featured} onPress={() => onOpen(featured.moduleId)} />
        </View>
      ) : null}

      {available.length ? (
        <View>
          <AppText variant="headline">New for Modula</AppText>
          {available.map((item, index) => (
            <ModuleRow
              key={`new-${item.moduleId}`}
              item={item}
              onPress={() => onOpen(item.moduleId)}
              showSeparator={index < available.length - 1}
            />
          ))}
        </View>
      ) : null}

      <ModuleShelf title="Made by Modula" items={madeByModula} onOpen={onOpen} />

      {PRODUCT_HUB_COLLECTIONS.map(collection => {
        const members = items.filter(item => collection.moduleIds.includes(item.moduleId))
        return (
          <ModuleCollection
            key={collection.id}
            title={collection.title}
            subtitle={collection.subtitle}
            items={members}
            onOpen={onOpen}
          />
        )
      })}

      {yours.length ? (
        <View>
          <AppText variant="headline">Your modules</AppText>
          {yours.map((item, index) => (
            <ModuleRow
              key={`yours-${item.moduleId}`}
              item={item}
              onPress={() => onOpen(item.moduleId)}
              showSeparator={index < yours.length - 1}
            />
          ))}
        </View>
      ) : null}

      {updates.length ? (
        <AppText variant="caption" colour="textSecondary">
          {updates.length} update{updates.length === 1 ? '' : 's'} available
        </AppText>
      ) : null}

      {!items.length ? (
        <View style={{gap: spacing[2]}}>
          <AppText variant="headline">Nothing here yet</AppText>
          <AppText variant="caption" colour="textSecondary">
            Modules you can install will appear here.
          </AppText>
        </View>
      ) : null}
    </View>
  )
}

function SearchMode({
  query,
  suggested,
  results,
  pending,
  onOpen,
  onBrowse,
}: {
  query: string
  suggested: ModuleCatalogueItem[]
  results: ModuleCatalogueItem[]
  pending: boolean
  onOpen: (moduleId: string) => void
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
        {modules.length ? (
          <View>
            <AppText variant="micro" colour="textTertiary">
              MODULES
            </AppText>
            {modules.map((item, index) => (
              <ModuleRow
                key={`result-${item.moduleId}`}
                item={item}
                onPress={() => onOpen(item.moduleId)}
                showSeparator={index < modules.length - 1}
              />
            ))}
          </View>
        ) : null}
        {tools.length ? (
          <View>
            <AppText variant="micro" colour="textTertiary">
              TOOLS
            </AppText>
            {tools.map((item, index) => (
              <ModuleRow
                key={`tool-${item.moduleId}`}
                item={item}
                onPress={() => onOpen(item.moduleId)}
                showSeparator={index < tools.length - 1}
              />
            ))}
          </View>
        ) : null}
        {!pending && !results.length ? (
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
        <AppText variant="headline">Suggested</AppText>
        {suggested.map((item, index) => (
          <ModuleRow
            key={`suggested-${item.moduleId}`}
            item={item}
            onPress={() => onOpen(item.moduleId)}
            showSeparator={index < suggested.length - 1}
          />
        ))}
      </View>
      <View style={{gap: spacing[3]}}>
        <AppText variant="headline">Browse</AppText>
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
