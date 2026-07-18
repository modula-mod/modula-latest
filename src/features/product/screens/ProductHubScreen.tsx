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
import {FEATURE_ATLAS} from '@/features/product/data/featureAtlas'
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
              GAIA executes, AKI verifies, and the AGI Governor controls. DIMON provides ownership.
              Forge lets the ecosystem grow.
            </AppText>
          </LinearGradient>

          <View style={{gap: spacing[3]}}>
            <AppText variant="headline">Create & extend</AppText>
            <AppText variant="body" colour="textSecondary">
              Builder craft inspired by Plan Mode + Preview panes — remapped to Modula modules.
            </AppText>
            <AppPressable
              accessibilityLabel="Open Feature Atlas"
              onPress={() => router.push('/product/atlas' as Href)}
              style={[
                styles.featured,
                {
                  borderRadius: radius.large,
                  borderColor: colours.accentBorder,
                  overflow: 'hidden',
                },
              ]}>
              <LinearGradient
                colors={
                  scheme === 'dark'
                    ? [colours.accentSubtle, '#0B1416']
                    : [colours.accentSubtle, colours.surface]
                }
                style={{padding: spacing[5], gap: spacing[3]}}>
                <AppText variant="caption" colour="accent">
                  FEATURED · ATLAS
                </AppText>
                <AppText variant="title">{FEATURE_ATLAS.length} mapped capabilities</AppText>
                <AppText variant="body" colour="textSecondary">
                  Browse Modula by domain and maturity. Preview surfaces are product maps, not
                  production runtimes.
                </AppText>
                <View style={[styles.ctaRow, {gap: spacing[2]}]}>
                  <AppText variant="label" colour="accent">
                    Open Feature Atlas
                  </AppText>
                  <AppIcon name="chevronRight" colour={colours.accent} size={16} />
                </View>
              </LinearGradient>
            </AppPressable>
            <AppPressable
              accessibilityLabel="Open Forge Builder"
              onPress={() => router.push('/product/forge' as Href)}
              style={[
                styles.featured,
                {
                  borderRadius: radius.large,
                  borderColor: colours.accentBorder,
                  overflow: 'hidden',
                },
              ]}>
              <LinearGradient
                colors={
                  scheme === 'dark'
                    ? [colours.accentSubtle, '#0B1416']
                    : [colours.accentSubtle, colours.surface]
                }
                style={{padding: spacing[5], gap: spacing[3]}}>
                <AppText variant="caption" colour="accent">
                  FEATURED · FORGE
                </AppText>
                <AppText variant="title">Plan → Build → Preview → Manifest</AppText>
                <AppText variant="body" colour="textSecondary">
                  Templates, chat discussion, permissions scan, version snapshots — publish stays
                  Preview until Registry sandbox ships.
                </AppText>
                <View style={[styles.ctaRow, {gap: spacing[2]}]}>
                  <AppText variant="label" colour="accent">
                    Open Forge Builder
                  </AppText>
                  <AppIcon name="chevronRight" colour={colours.accent} size={16} />
                </View>
              </LinearGradient>
            </AppPressable>
            <View style={[styles.grid, {gap: spacing[3]}]}>
              {[
                {
                  id: 'design-lab',
                  name: 'Design Lab',
                  summary: 'Inspiration remap Preview.',
                  icon: 'palette' as const,
                  route: '/product/design-lab',
                },
                {
                  id: 'start',
                  name: 'Start',
                  summary: 'Quick actions + command previews.',
                  icon: 'switch' as const,
                  route: '/product/start',
                },
                {
                  id: 'chat-assist',
                  name: 'Chat Assist',
                  summary: 'Message assist permissions + Quiet Send.',
                  icon: 'messages' as const,
                  route: '/product/chat-assist',
                },
                {
                  id: 'intelligence',
                  name: 'Intelligence',
                  summary: 'GAIA · AKI · Governor map.',
                  icon: 'discover' as const,
                  route: '/product/intelligence',
                },
                {
                  id: 'commands',
                  name: 'Commands',
                  summary: 'Universal execution router.',
                  icon: 'developer' as const,
                  route: '/product/commands',
                },
                {
                  id: 'developer',
                  name: 'Developer Tools',
                  summary: 'Greenfield MCP + Modula CLI.',
                  icon: 'tools' as const,
                  route: '/product/developer',
                },
                {
                  id: 'agents',
                  name: 'Agents',
                  summary: 'Scoped GAIA agent packages.',
                  icon: 'automation' as const,
                  route: '/product/agents',
                },
                {
                  id: 'nft',
                  name: 'NFT Studio',
                  summary: 'Ownership proofs reserved; DIMON inactive.',
                  icon: 'security' as const,
                  route: '/product/nft',
                },
                {
                  id: 'standards',
                  name: 'Module Standards',
                  summary: 'Manifest + skill.md DNA.',
                  icon: 'check' as const,
                  route: '/product/module-standards',
                },
                {
                  id: 'permissions',
                  name: 'Permissions',
                  summary: 'Least-privilege matrix + scan.',
                  icon: 'privacy' as const,
                  route: '/product/permissions',
                },
                {
                  id: 'themes',
                  name: 'Themes & Layouts',
                  summary: 'Packs for Profile-OS.',
                  icon: 'appearance' as const,
                  route: '/product/themes',
                },
                {
                  id: 'sandbox',
                  name: 'Module Sandbox',
                  summary: 'Isolation foreshadow for installs.',
                  icon: 'security' as const,
                  route: '/product/sandbox',
                },
              ].map(item => (
                <AppPressable
                  key={item.id}
                  accessibilityLabel={item.name}
                  onPress={() => router.push(item.route as Href)}
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
                  <AppText variant="caption" colour="textSecondary">
                    {item.summary}
                  </AppText>
                </AppPressable>
              ))}
            </View>
          </View>

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
                      <AppText variant="caption" colour="textSecondary">
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
  featured: {borderWidth: StyleSheet.hairlineWidth, width: '100%'},
  ctaRow: {alignItems: 'center', flexDirection: 'row'},
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
