import {ScrollView, StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'
import {LinearGradient} from 'expo-linear-gradient'
import {useSafeAreaInsets} from 'react-native-safe-area-context'

import {AppIcon} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import {
  productCatalogue,
  type ProductMaturity,
} from '@/features/product/data/productCatalogue'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const ORDER: ProductMaturity[] = ['live', 'preview', 'planned', 'inactive']
const LABELS: Record<ProductMaturity, string> = {
  live: 'Live now',
  preview: 'Preview surfaces',
  planned: 'Planned',
  inactive: 'Inactive by design',
}

export function ProductHubScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const {colours, radius, spacing, scheme} = useThemeTokens()
  const wash =
    scheme === 'dark'
      ? ['#0B1416', colours.accentSubtle]
      : [colours.accentSubtle, colours.canvas]

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title="Modula" />
      <ResponsiveContent maxWidth={760}>
        <ScrollView
          contentContainerStyle={{
            gap: spacing[5],
            padding: spacing[4],
            paddingBottom: insets.bottom + spacing[8],
          }}>
          <LinearGradient
            colors={wash as [string, string]}
            style={[styles.hero, {borderRadius: radius.large, padding: spacing[5], gap: spacing[3]}]}>
            <AppText variant="caption" colour="accent">
              SOCIAL OS · PROFILE-OS
            </AppText>
            <AppText variant="display">Everything Modula offers</AppText>
            <AppText variant="body" colour="textSecondary">
              Social is the foundation. The profile is the platform. Modules provide capabilities.
              Gaia provides intelligence. DIMON provides ownership. Forge lets the ecosystem grow.
            </AppText>
          </LinearGradient>

          {ORDER.map(maturity => {
            const items = productCatalogue.filter(item => item.maturity === maturity)
            if (items.length === 0) return null
            return (
              <View key={maturity} style={{gap: spacing[3]}}>
                <AppText variant="headline">{LABELS[maturity]}</AppText>
                <View style={[styles.grid, {gap: spacing[3]}]}>
                  {items.map(item => (
                    <AppPressable
                      key={item.id}
                      accessibilityLabel={`Open ${item.name}`}
                      onPress={() => router.push(`/product/${item.id}` as Href)}
                      style={[
                        styles.card,
                        {
                          backgroundColor: colours.surface,
                          borderColor: colours.border,
                          borderRadius: radius.large,
                          padding: spacing[4],
                          gap: spacing[2],
                        },
                      ]}>
                      <AppIcon name={item.icon} colour={colours.accent} />
                      <AppText variant="headline">{item.name}</AppText>
                      <AppText variant="caption" colour="textSecondary" numberOfLines={3}>
                        {item.summary}
                      </AppText>
                    </AppPressable>
                  ))}
                </View>
              </View>
            )
          })}

          <Surface
            variant="contained"
            style={[
              styles.note,
              {
                padding: spacing[4],
                gap: spacing[2],
                borderRadius: radius.medium,
                backgroundColor: colours.surfaceRaised,
                borderColor: colours.border,
              },
            ]}>
            <AppText variant="label">Honesty rule</AppText>
            <AppText variant="caption" colour="textSecondary">
              Preview and planned surfaces explain product direction. They do not fake wallets,
              execute untrusted module code, or claim production Marketplace billing.
            </AppText>
          </Surface>
        </ScrollView>
      </ResponsiveContent>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {flex: 1},
  hero: {width: '100%'},
  grid: {flexDirection: 'row', flexWrap: 'wrap'},
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    flexBasis: '47%',
    flexGrow: 1,
    minHeight: 140,
    minWidth: 150,
  },
  note: {borderWidth: StyleSheet.hairlineWidth},
})
