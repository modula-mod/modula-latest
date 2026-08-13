import {useEffect, useMemo, useState} from 'react'
import {ScrollView, StyleSheet, TextInput, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'
import type {GreenfieldSearchEntityType, GreenfieldSearchResult} from '@modula/api-contracts'

import {QueryErrorState} from '@/components/data'
import {AppButton} from '@/components/primitives/AppButton'
import {AppIcon, type AppIconName} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {
  type UniversalSearchScope,
  useRecentSearchesQuery,
  useSavedSearchesQuery,
  useSearchPersistenceMutations,
  useUniversalSearchQuery,
} from '@/features/product/data/useUniversalSearch'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type SearchScopeOption = {
  id: UniversalSearchScope
  label: string
}

type SearchFilterView = {
  entityTypes?: unknown
}

const SEARCH_SCOPES: SearchScopeOption[] = [
  {id: 'all', label: 'All'},
  {id: 'profiles', label: 'People'},
  {id: 'posts', label: 'Posts'},
  {id: 'modules', label: 'Modules'},
]

export function UniversalSearchScreen() {
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()
  const [draftQuery, setDraftQuery] = useState('')
  const [activeQuery, setActiveQuery] = useState('')
  const [scope, setScope] = useState<UniversalSearchScope>('all')
  const searchQuery = useUniversalSearchQuery({query: activeQuery, scope, limit: 6})
  const recentQuery = useRecentSearchesQuery()
  const savedQuery = useSavedSearchesQuery()
  const mutations = useSearchPersistenceMutations()
  const trimmedDraft = draftQuery.trim()
  const results = useMemo(
    () => searchQuery.data?.pages.flatMap(page => page.results) ?? [],
    [searchQuery.data],
  )
  const savedSearches = savedQuery.data ?? []
  const recentSearches = recentQuery.data ?? []
  const currentSearchSaved = savedSearches.some(saved => {
    return saved.query.trim().toLowerCase() === activeQuery.toLowerCase() && scopeFromFilters(saved.filters) === scope
  })
  const canSaveSearch = activeQuery.length > 0 && !currentSearchSaved
  const showLibrary = trimmedDraft.length === 0
  const isInitialSearching =
    activeQuery.length > 0 && searchQuery.isPending && !searchQuery.data

  useEffect(() => {
    const nextQuery = draftQuery.trim()
    const timer = setTimeout(() => setActiveQuery(nextQuery), 250)
    return () => clearTimeout(timer)
  }, [draftQuery])

  const runStoredSearch = (query: string, entityTypes?: GreenfieldSearchEntityType[]) => {
    const nextScope = scopeFromEntityTypes(entityTypes)
    setScope(nextScope)
    setDraftQuery(query)
    setActiveQuery(query.trim())
  }

  const saveCurrentSearch = () => {
    if (!canSaveSearch) return
    mutations.save.mutate({
      name: activeQuery,
      query: activeQuery,
      scope,
    })
  }

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title="Search" />
      <ResponsiveContent maxWidth={760}>
        <ScrollView contentContainerStyle={{gap: spacing[4], padding: spacing[4]}}>
          <View style={{gap: spacing[2]}}>
            <AppText variant="display">Search</AppText>
            <AppText variant="body" colour="textSecondary">
              Find people, posts, and modules available to your account.
            </AppText>
          </View>

          <TextInput
            testID="universal-search-input"
            value={draftQuery}
            onChangeText={setDraftQuery}
            onSubmitEditing={() => setActiveQuery(trimmedDraft)}
            placeholder="Search people, posts, modules"
            placeholderTextColor={colours.textTertiary}
            accessibilityLabel="Search people, posts, modules"
            returnKeyType="search"
            style={[
              styles.input,
              {
                backgroundColor: colours.surface,
                borderColor: colours.border,
                borderRadius: radius.medium,
                color: colours.text,
                paddingHorizontal: spacing[4],
              },
            ]}
          />

          <SearchScopePicker value={scope} onChange={setScope} />

          {showLibrary ? (
            <SearchLibrary
              recent={recentSearches}
              saved={savedSearches}
              recentLoading={recentQuery.isLoading}
              savedLoading={savedQuery.isLoading}
              onRun={runStoredSearch}
              onDeleteRecent={recentSearchId => mutations.deleteRecent.mutate(recentSearchId)}
              onDeleteSaved={savedSearchId => mutations.deleteSaved.mutate(savedSearchId)}
            />
          ) : null}

          {activeQuery.length > 0 ? (
            <View style={{gap: spacing[3]}}>
              <View style={styles.actionsRow}>
                <AppButton
                  variant="secondary"
                  accessibilityLabel="Save current search"
                  disabled={!canSaveSearch || mutations.save.isPending}
                  onPress={saveCurrentSearch}
                  style={styles.actionButton}>
                  {currentSearchSaved ? 'Saved' : 'Save search'}
                </AppButton>
              </View>

              {searchQuery.error ? (
                <QueryErrorState
                  title="Search failed"
                  error={searchQuery.error}
                  onRetry={() => void searchQuery.refetch()}
                />
              ) : null}

              {isInitialSearching ? (
                <AppText testID="universal-search-loading" variant="body" colour="textSecondary">
                  Searching
                </AppText>
              ) : null}

              {!isInitialSearching && !searchQuery.error && results.length === 0 ? (
                <AppText testID="universal-search-empty" variant="body" colour="textSecondary">
                  No search results
                </AppText>
              ) : null}

              {results.length > 0 ? (
                <View testID="universal-search-results" style={{gap: spacing[2]}}>
                  <AppText variant="caption" colour="accent">
                    Results
                  </AppText>
                  {results.map(result => (
                    <SearchResultRow
                      key={`${result.entityType}:${result.entityId}`}
                      result={result}
                      onPress={() => {
                        const route = routeForSearchResult(result)
                        if (route) router.push(route)
                      }}
                    />
                  ))}
                </View>
              ) : null}

              {searchQuery.hasNextPage ? (
                <AppButton
                  variant="secondary"
                  accessibilityLabel="Load more search results"
                  disabled={searchQuery.isFetchingNextPage}
                  onPress={() => void searchQuery.fetchNextPage()}>
                  {searchQuery.isFetchingNextPage ? 'Loading' : 'Load more'}
                </AppButton>
              ) : null}
            </View>
          ) : null}
        </ScrollView>
      </ResponsiveContent>
    </View>
  )
}

function SearchScopePicker({
  value,
  onChange,
}: {
  value: UniversalSearchScope
  onChange: (scope: UniversalSearchScope) => void
}) {
  const {colours, radius, spacing} = useThemeTokens()
  return (
    <View
      testID="universal-search-scope"
      accessibilityLabel="Search scope"
      accessibilityRole="tablist"
      style={[
        styles.scopePicker,
        {
          backgroundColor: colours.surfaceMuted,
          borderColor: colours.border,
          borderRadius: radius.medium,
          padding: spacing[1],
        },
      ]}>
      {SEARCH_SCOPES.map(option => {
        const selected = option.id === value
        return (
          <AppPressable
            key={option.id}
            accessibilityLabel={`Search ${option.label}`}
            accessibilityRole="tab"
            accessibilityState={{selected}}
            onPress={() => onChange(option.id)}
            style={[
              styles.scopeOption,
              {
                backgroundColor: selected ? colours.surface : 'transparent',
                borderRadius: radius.small,
                paddingHorizontal: spacing[3],
                paddingVertical: spacing[2],
              },
            ]}>
            <AppText variant="label" colour={selected ? 'text' : 'textSecondary'}>
              {option.label}
            </AppText>
          </AppPressable>
        )
      })}
    </View>
  )
}

function SearchLibrary({
  recent,
  saved,
  recentLoading,
  savedLoading,
  onRun,
  onDeleteRecent,
  onDeleteSaved,
}: {
  recent: {recentSearchId: string; query: string; filters: SearchFilterView}[]
  saved: {savedSearchId: string; query: string; filters: SearchFilterView}[]
  recentLoading: boolean
  savedLoading: boolean
  onRun: (query: string, entityTypes?: GreenfieldSearchEntityType[]) => void
  onDeleteRecent: (recentSearchId: string) => void
  onDeleteSaved: (savedSearchId: string) => void
}) {
  const {spacing} = useThemeTokens()

  return (
    <View testID="universal-search-library" style={{gap: spacing[4]}}>
      <SearchHistorySection
        title="Saved"
        emptyLabel={savedLoading ? 'Loading saved searches' : 'No saved searches'}
        items={saved.map(item => ({
          id: item.savedSearchId,
          label: item.query,
          entityTypes: entityTypesFromFilters(item.filters),
        }))}
        deleteLabel="Remove saved search"
        onRun={onRun}
        onDelete={onDeleteSaved}
      />
      <SearchHistorySection
        title="Recent"
        emptyLabel={recentLoading ? 'Loading recent searches' : 'No recent searches'}
        items={recent.map(item => ({
          id: item.recentSearchId,
          label: item.query,
          entityTypes: entityTypesFromFilters(item.filters),
        }))}
        deleteLabel="Remove recent search"
        onRun={onRun}
        onDelete={onDeleteRecent}
      />
    </View>
  )
}

function SearchHistorySection({
  title,
  emptyLabel,
  items,
  deleteLabel,
  onRun,
  onDelete,
}: {
  title: string
  emptyLabel: string
  items: {id: string; label: string; entityTypes?: GreenfieldSearchEntityType[]}[]
  deleteLabel: string
  onRun: (query: string, entityTypes?: GreenfieldSearchEntityType[]) => void
  onDelete: (id: string) => void
}) {
  const {spacing} = useThemeTokens()

  return (
    <View style={{gap: spacing[2]}}>
      <AppText variant="caption" colour="accent">
        {title}
      </AppText>
      {items.length === 0 ? (
        <AppText variant="body" colour="textSecondary">
          {emptyLabel}
        </AppText>
      ) : (
        <View style={{gap: spacing[2]}}>
          {items.map(item => (
            <SearchHistoryRow
              key={item.id}
              label={item.label}
              deleteLabel={deleteLabel}
              onRun={() => onRun(item.label, item.entityTypes)}
              onDelete={() => onDelete(item.id)}
            />
          ))}
        </View>
      )}
    </View>
  )
}

function SearchHistoryRow({
  label,
  deleteLabel,
  onRun,
  onDelete,
}: {
  label: string
  deleteLabel: string
  onRun: () => void
  onDelete: () => void
}) {
  const {colours, radius, spacing} = useThemeTokens()
  return (
    <View
      style={[
        styles.historyRow,
        {
          backgroundColor: colours.surface,
          borderColor: colours.border,
          borderRadius: radius.medium,
          padding: spacing[3],
          gap: spacing[3],
        },
      ]}>
      <AppPressable
        accessibilityLabel={`Run search ${label}`}
        onPress={onRun}
        style={styles.historyQuery}>
        <AppIcon name="search" colour={colours.accent} size={18} />
        <AppText variant="body">{label}</AppText>
      </AppPressable>
      <AppPressable
        accessibilityLabel={`${deleteLabel}: ${label}`}
        onPress={onDelete}
        style={styles.iconButton}>
        <AppIcon name="trash" colour={colours.textTertiary} size={18} />
      </AppPressable>
    </View>
  )
}

function SearchResultRow({
  result,
  onPress,
}: {
  result: GreenfieldSearchResult
  onPress: () => void
}) {
  const {colours, radius, spacing} = useThemeTokens()
  const route = routeForSearchResult(result)
  const title = result.title ?? fallbackTitleForResult(result)
  const label = labelForEntityType(result.entityType)

  return (
    <AppPressable
      testID="universal-search-result"
      accessibilityLabel={`${label}: ${title}`}
      disabled={!route}
      onPress={onPress}
      style={[
        styles.hit,
        {
          backgroundColor: colours.surface,
          borderColor: colours.border,
          borderRadius: radius.medium,
          padding: spacing[3],
          gap: spacing[3],
        },
      ]}>
      <AppIcon name={iconForEntityType(result.entityType)} colour={colours.accent} />
      <View style={styles.hitText}>
        <AppText variant="headline">{title}</AppText>
        <AppText variant="caption" colour="textSecondary">
          {label}
        </AppText>
        {result.excerpt ? (
          <AppText variant="caption" colour="textTertiary">
            {result.excerpt}
          </AppText>
        ) : null}
      </View>
      {route ? <AppIcon name="chevronRight" colour={colours.textTertiary} size={18} /> : null}
    </AppPressable>
  )
}

function labelForEntityType(entityType: string) {
  if (entityType === 'profile') return 'Profile'
  if (entityType === 'post') return 'Post'
  if (entityType === 'module') return 'Module'
  if (entityType === 'module-release') return 'Module release'
  return 'Search result'
}

function iconForEntityType(entityType: string): AppIconName {
  if (entityType === 'profile') return 'profile'
  if (entityType === 'post') return 'comment'
  if (entityType === 'module' || entityType === 'module-release') return 'modules'
  return 'search'
}

function fallbackTitleForResult(result: GreenfieldSearchResult) {
  if (result.entityType === 'profile') return 'Profile'
  if (result.entityType === 'post') return 'Post'
  if (result.entityType === 'module' || result.entityType === 'module-release') return 'Module'
  return result.entityId
}

function routeForSearchResult(result: GreenfieldSearchResult): Href | null {
  if (result.entityType === 'profile') {
    const handle = metadataString(result.metadata, 'handle')
    return handle ? (`/profile/${encodeURIComponent(handle)}` as Href) : null
  }
  if (result.entityType === 'post') {
    return `/post/${encodeURIComponent(result.entityId)}` as Href
  }
  if (result.entityType === 'module' || result.entityType === 'module-release') {
    const moduleId = metadataString(result.metadata, 'moduleId') ?? result.entityId
    return `/marketplace/${encodeURIComponent(moduleId)}` as Href
  }
  return null
}

function metadataString(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key]
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

function scopeFromFilters(filters: SearchFilterView): UniversalSearchScope {
  return scopeFromEntityTypes(entityTypesFromFilters(filters))
}

function scopeFromEntityTypes(entityTypes?: GreenfieldSearchEntityType[]): UniversalSearchScope {
  if (!entityTypes || entityTypes.length === 0) return 'all'
  const normalized = [...new Set(entityTypes)]
  if (sameEntityTypes(normalized, ['profile'])) return 'profiles'
  if (sameEntityTypes(normalized, ['post'])) return 'posts'
  if (sameEntityTypes(normalized, ['module', 'module-release'])) return 'modules'
  return 'all'
}

function entityTypesFromFilters(
  filters: SearchFilterView,
): GreenfieldSearchEntityType[] | undefined {
  const entityTypes = filters.entityTypes
  if (!Array.isArray(entityTypes)) return undefined
  return entityTypes.filter(isSearchEntityType)
}

function isSearchEntityType(value: unknown): value is GreenfieldSearchEntityType {
  return (
    value === 'profile' ||
    value === 'post' ||
    value === 'module' ||
    value === 'module-release' ||
    value === 'note' ||
    value === 'vault-folder'
  )
}

function sameEntityTypes(left: GreenfieldSearchEntityType[], right: GreenfieldSearchEntityType[]) {
  const leftKey = [...left].sort().join(',')
  const rightKey = [...right].sort().join(',')
  return leftKey === rightKey
}

const styles = StyleSheet.create({
  screen: {flex: 1},
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 48,
  },
  scopePicker: {
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  scopeOption: {
    alignItems: 'center',
    flexGrow: 1,
    minHeight: 40,
    justifyContent: 'center',
  },
  actionsRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
  },
  actionButton: {
    maxWidth: 180,
  },
  historyRow: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
  },
  historyQuery: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
  },
  hit: {
    alignItems: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
  },
  hitText: {flex: 1, gap: 4},
})
