import {useMemo, useState} from 'react'
import {ScrollView, StyleSheet, TextInput, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {AppIcon} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {Pill} from '@/components/primitives/Pill'
import {Surface} from '@/components/primitives/Surface'
import {
  marketplaceCatalog,
  marketplaceCategories,
  marketplaceSellers,
  searchMarketplace,
  type MarketplaceCategory,
  type MarketplaceModule,
} from '@/features/marketplace/data/catalog'
import {ModulaMenu} from '@/platform/ui/menus/modula-menu'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type SortMode = 'featured' | 'new' | 'name'

export function MarketplaceScreen() {
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<MarketplaceCategory | 'all'>('all')
  const [sort, setSort] = useState<SortMode>('featured')

  const modules = useMemo(() => {
    let list = searchMarketplace(query)
    if (category !== 'all') {
      list = list.filter(module => module.category === category)
    }
    if (sort === 'name') {
      return [...list].sort((a, b) => a.name.localeCompare(b.name))
    }
    if (sort === 'new') {
      return [...list].sort((a, b) => Number(b.section.includes('new')) - Number(a.section.includes('new')))
    }
    return [...list].sort(
      (a, b) => Number(b.section.includes('featured')) - Number(a.section.includes('featured')),
    )
  }, [category, query, sort])

  const featured = marketplaceCatalog.filter(m => m.section.includes('featured')).slice(0, 4)
  const newest = marketplaceCatalog.filter(m => m.section.includes('new')).slice(0, 4)
  const forYou = marketplaceCatalog.filter(m => m.section.includes('forYou')).slice(0, 4)

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader
        title="Marketplace"
        right={
          <ModulaMenu
            accessibilityLabel="Marketplace sort menu"
            title="Sort modules"
            actions={[
              {id: 'featured', label: 'Featured first'},
              {id: 'new', label: 'New first'},
              {id: 'name', label: 'Name A–Z'},
            ]}
            onAction={id => setSort(id as SortMode)}
            trigger={<AppIcon name="more" colour={colours.textSecondary} />}
          />
        }
      />
      <ResponsiveContent>
        <ScrollView
          contentContainerStyle={[styles.content, {gap: spacing[5]}]}
          keyboardShouldPersistTaps="handled">
          <View style={{gap: spacing[2]}}>
            <AppText variant="display">Marketplace</AppText>
            <AppText variant="body" colour="textSecondary">
              Browse seeded modules and tools. Install remains a Preview — nothing is provisioned remotely.
            </AppText>
          </View>

          <View
            style={[
              styles.search,
              {
                backgroundColor: colours.surfaceRaised,
                borderColor: colours.border,
                borderRadius: radius.round,
                paddingHorizontal: spacing[4],
              },
            ]}>
            <AppIcon name="search" colour={colours.textSecondary} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search modules and tools"
              placeholderTextColor={colours.textTertiary}
              style={[styles.searchInput, {color: colours.text}]}
              returnKeyType="search"
              accessibilityLabel="Search marketplace"
            />
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap: spacing[2]}}>
            {marketplaceCategories.map(item => (
              <Pill
                key={item.id}
                label={item.label}
                selected={category === item.id}
                onPress={() => setCategory(item.id)}
              />
            ))}
          </ScrollView>

          {!query && category === 'all' ? (
            <>
              <ModuleRail
                title="Featured"
                modules={featured}
                onOpen={id => router.push(`/marketplace/${id}` as Href)}
              />
              <ModuleRail
                title="New"
                modules={newest}
                onOpen={id => router.push(`/marketplace/${id}` as Href)}
              />
              <ModuleRail
                title="For you"
                modules={forYou}
                onOpen={id => router.push(`/marketplace/${id}` as Href)}
              />
              <View style={{gap: spacing[3]}}>
                <AppText variant="headline">Creators</AppText>
                {marketplaceSellers.map(seller => (
                  <AppPressable
                    key={seller.id}
                    accessibilityLabel={`Open ${seller.name}`}
                    onPress={() => router.push(`/marketplace/seller/${seller.id}` as Href)}
                    style={[
                      styles.sellerRow,
                      {
                        backgroundColor: colours.surfaceRaised,
                        borderColor: colours.border,
                        borderRadius: radius.large,
                        padding: spacing[4],
                        gap: spacing[3],
                      },
                    ]}>
                    <View
                      style={[
                        styles.sellerIcon,
                        {backgroundColor: colours.accentSubtle, borderRadius: radius.medium},
                      ]}>
                      <AppIcon name="people" colour={colours.accent} />
                    </View>
                    <View style={styles.flex}>
                      <AppText variant="label">{seller.name}</AppText>
                      <AppText variant="caption" colour="textSecondary">
                        @{seller.handle} · {seller.moduleCount} modules · Preview
                      </AppText>
                    </View>
                    <AppIcon name="chevronRight" colour={colours.textTertiary} size={18} />
                  </AppPressable>
                ))}
              </View>
            </>
          ) : null}

          <View style={{gap: spacing[3]}}>
            <AppText variant="headline">
              {query || category !== 'all' ? 'Results' : 'All modules'}
            </AppText>
            {modules.length ? (
              modules.map(module => (
                <ModuleRow
                  key={module.id}
                  module={module}
                  onPress={() => router.push(`/marketplace/${module.id}` as Href)}
                />
              ))
            ) : (
              <AppText variant="body" colour="textSecondary">
                No modules match this search.
              </AppText>
            )}
          </View>
        </ScrollView>
      </ResponsiveContent>
    </View>
  )
}

function ModuleRail({
  title,
  modules,
  onOpen,
}: {
  title: string
  modules: MarketplaceModule[]
  onOpen: (id: string) => void
}) {
  const {colours, radius, spacing} = useThemeTokens()
  return (
    <View style={{gap: spacing[3]}}>
      <AppText variant="headline">{title}</AppText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap: spacing[3]}}>
        {modules.map(module => (
          <AppPressable
            key={module.id}
            accessibilityLabel={`Open ${module.name}`}
            onPress={() => onOpen(module.id)}
            style={[
              styles.railCard,
              {
                backgroundColor: colours.surface,
                borderColor: colours.border,
                borderRadius: radius.large,
                padding: spacing[4],
                gap: spacing[2],
              },
            ]}>
            <AppIcon name={module.icon} colour={colours.accent} />
            <AppText variant="label" numberOfLines={1}>
              {module.name}
            </AppText>
            <AppText variant="caption" colour="textSecondary" numberOfLines={2}>
              {module.description}
            </AppText>
            <AppText variant="caption" colour="accent">
              {module.status}
            </AppText>
          </AppPressable>
        ))}
      </ScrollView>
    </View>
  )
}

function ModuleRow({
  module,
  onPress,
}: {
  module: MarketplaceModule
  onPress: () => void
}) {
  const {colours, radius, spacing} = useThemeTokens()
  return (
    <AppPressable
      accessibilityLabel={`Open ${module.name}`}
      onPress={onPress}
      style={[styles.moduleRow, {gap: spacing[3], minHeight: 64}]}>
      <View
        style={[
          styles.moduleIcon,
          {backgroundColor: colours.accentSubtle, borderRadius: radius.medium},
        ]}>
        <AppIcon name={module.icon} colour={colours.accent} />
      </View>
      <View style={styles.flex}>
        <AppText variant="label">{module.name}</AppText>
        <AppText variant="caption" colour="textSecondary" numberOfLines={2}>
          {module.description}
        </AppText>
      </View>
      <AppText variant="caption" colour="accent">
        {module.status}
      </AppText>
    </AppPressable>
  )
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  moduleIcon: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  moduleRow: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  railCard: {
    borderWidth: StyleSheet.hairlineWidth,
    width: 168,
  },
  screen: {
    flex: 1,
  },
  search: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 8,
    minHeight: 46,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    minHeight: 44,
  },
  sellerIcon: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  sellerRow: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
  },
})
