import {ScrollView, StyleSheet, View} from 'react-native'
import {useLocalSearchParams, useRouter, type Href} from 'expo-router'

import {AppIcon} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {EmptyState} from '@/components/primitives/EmptyState'
import {Surface} from '@/components/primitives/Surface'
import {MarketplaceStatusBadge} from '@/features/marketplace/components/MarketplaceStatusBadge'
import {
  getMarketplaceSeller,
  modulesForSeller,
} from '@/features/marketplace/data/catalog'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function SellerPreviewScreen() {
  const {sellerId} = useLocalSearchParams<{sellerId: string}>()
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()
  const seller = getMarketplaceSeller(String(sellerId ?? ''))
  const modules = seller ? modulesForSeller(seller.id) : []

  if (!seller) {
    return (
      <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
        <SecondaryScreenHeader title="Creator" />
        <EmptyState
          icon="people"
          title="Creator not found"
          description="This seller preview is not in the seeded marketplace catalog."
        />
      </View>
    )
  }

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title={seller.name} />
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
              <AppText variant="display">{seller.name}</AppText>
              <AppText variant="caption" colour="textSecondary">
                @{seller.handle} · Creator preview
              </AppText>
              <AppText variant="body" colour="textSecondary">
                {seller.bio}
              </AppText>
            </View>
          </Surface>

          <View style={{gap: spacing[3]}}>
            <AppText variant="headline">Modules</AppText>
            {modules.map(module => (
              <AppPressable
                key={module.id}
                accessibilityLabel={`Open ${module.name}`}
                onPress={() => router.push(`/marketplace/${module.id}` as Href)}
                style={[styles.row, {gap: spacing[3], minHeight: 56}]}>
                <AppIcon name={module.icon} colour={colours.accent} />
                <View style={styles.flex}>
                  <AppText variant="label">{module.name}</AppText>
                  <AppText variant="caption" colour="textSecondary">
                    {module.description}
                  </AppText>
                </View>
                <MarketplaceStatusBadge status={module.status} />
                <AppIcon name="chevronRight" colour={colours.textTertiary} size={18} />
              </AppPressable>
            ))}
          </View>
        </ScrollView>
      </ResponsiveContent>
    </View>
  )
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
