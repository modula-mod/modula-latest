import {ScrollView, StyleSheet, View} from 'react-native'
import {useLocalSearchParams, useRouter, type Href} from 'expo-router'

import {AppIcon} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {EmptyState} from '@/components/primitives/EmptyState'
import {Surface} from '@/components/primitives/Surface'
import type {ModuleCatalogueItem} from '@/data/repositories/contracts'
import {MarketplaceStatusBadge} from '@/features/marketplace/components/MarketplaceStatusBadge'
import {useModuleCatalogueQuery} from '@/features/modules/hooks'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function SellerPreviewScreen() {
  const {sellerId} = useLocalSearchParams<{sellerId: string}>()
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()
  const catalogue = useModuleCatalogueQuery()
  const publisherId = publisherIdFromRoute(String(sellerId ?? ''))
  const modules = (catalogue.data ?? []).filter(module => module.publisherId === publisherId)
  const sellerName = modules[0]?.publisherName ?? publisherId

  if (!catalogue.isLoading && modules.length === 0) {
    return (
      <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
        <SecondaryScreenHeader title="Creator" />
        <EmptyState
          icon="people"
          title="Creator not found"
          description="No registry modules are published for this creator."
        />
      </View>
    )
  }

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title={sellerName} />
      <ResponsiveContent>
        <ScrollView
          contentContainerStyle={[styles.content, {gap: spacing[5]}]}
          keyboardShouldPersistTaps="handled">
          <Surface
            variant="contained"
            style={[styles.hero, {gap: spacing[3], padding: spacing[4]}]}>
            <View
              style={[
                styles.icon,
                {backgroundColor: colours.accentSubtle, borderRadius: radius.large},
              ]}>
              <AppIcon name="people" colour={colours.accent} size={28} />
            </View>
            <View style={styles.flex}>
              <AppText variant="display">{sellerName}</AppText>
              <AppText variant="caption" colour="textSecondary">
                @{publisherId} · Registry publisher
              </AppText>
              <AppText variant="body" colour="textSecondary">
                Modules shown here come from the Greenfield registry.
              </AppText>
            </View>
          </Surface>

          <View style={{gap: spacing[3]}}>
            <AppText variant="headline">Modules</AppText>
            {modules.map(module => (
              <AppPressable
                key={module.moduleId}
                accessibilityLabel={`Open ${module.name}`}
                onPress={() => router.push(`/marketplace/${module.moduleId}` as Href)}
                style={[styles.row, {gap: spacing[3], minHeight: 56}]}>
                <AppIcon name={iconForModule(module)} colour={colours.accent} />
                <View style={styles.flex}>
                  <AppText variant="label">{module.name}</AppText>
                  <AppText variant="caption" colour="textSecondary">
                    {module.description}
                  </AppText>
                </View>
                <MarketplaceStatusBadge status={statusForModule(module)} />
                <AppIcon name="chevronRight" colour={colours.textTertiary} size={18} />
              </AppPressable>
            ))}
          </View>
        </ScrollView>
      </ResponsiveContent>
    </View>
  )
}

function publisherIdFromRoute(sellerId: string): string {
  return sellerId.replace(/^seller-/, '') || 'modula'
}

function iconForModule(module: ModuleCatalogueItem) {
  if (module.kind === 'system') return 'settings'
  if (module.category === 'Developer') return 'developer'
  return 'modules'
}

function statusForModule(module: ModuleCatalogueItem) {
  if (module.installable) return 'Preview'
  if (module.installationState === 'comingSoon') return 'Planned'
  return 'Inactive'
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  flex: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  hero: {
    alignItems: 'flex-start',
    flexDirection: 'row',
  },
  icon: {
    alignItems: 'center',
    height: 64,
    justifyContent: 'center',
    width: 64,
  },
  row: {
    alignItems: 'flex-start',
    flexDirection: 'row',
  },
  screen: {
    flex: 1,
  },
})
