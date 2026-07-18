import {ScrollView, StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {AppButton} from '@/components/primitives/AppButton'
import {AppIcon} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import {marketplaceCatalog} from '@/features/marketplace/data/catalog'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function ModulesLibraryScreen() {
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title="Modules" />
      <ResponsiveContent maxWidth={760}>
        <ScrollView contentContainerStyle={{gap: spacing[5], padding: spacing[4]}}>
          <View style={{gap: spacing[2]}}>
            <AppText variant="display">Capabilities for your environment.</AppText>
            <AppText variant="body" colour="textSecondary">
              Modules ship as packages. Open a pre-screen to see what each one can register before
              Registry install lands.
            </AppText>
          </View>

          <View style={[styles.actions, {gap: spacing[3]}]}>
            <AppButton onPress={() => router.push('/marketplace' as Href)}>Marketplace</AppButton>
            <AppButton variant="secondary" onPress={() => router.push('/product/forge' as Href)}>
              Forge Builder
            </AppButton>
            <AppButton variant="ghost" onPress={() => router.push('/product/module-standards' as Href)}>
              Module standards
            </AppButton>
            <AppButton variant="ghost" onPress={() => router.push('/product' as Href)}>
              All capabilities
            </AppButton>
          </View>

          {(
            [
              {
                title: 'Build',
                ids: ['module-forge', 'module-standards', 'module-agents', 'module-themes', 'module-layouts'],
              },
              {
                title: 'Intelligence',
                ids: marketplaceCatalog
                  .filter(m => m.category === 'intelligence')
                  .map(m => m.id),
              },
              {
                title: 'Productivity',
                ids: marketplaceCatalog
                  .filter(m => m.category === 'productivity')
                  .map(m => m.id),
              },
              {
                title: 'All modules',
                ids: marketplaceCatalog.map(m => m.id),
              },
            ] as const
          ).map(shelf => {
            const items = shelf.ids
              .map(id => marketplaceCatalog.find(module => module.id === id))
              .filter((module): module is (typeof marketplaceCatalog)[number] => Boolean(module))
            if (items.length === 0) return null
            return (
              <View key={shelf.title} style={{gap: spacing[3]}}>
                <AppText variant="headline">{shelf.title}</AppText>
                <View style={[styles.grid, {gap: spacing[3]}]}>
                  {items.map(module => (
                    <AppPressable
                      key={`${shelf.title}-${module.id}`}
                      accessibilityLabel={`Open ${module.name} pre-screen`}
                      onPress={() => router.push(`/marketplace/${module.id}` as Href)}
                      style={[
                        styles.card,
                        {
                          backgroundColor:
                            shelf.title === 'Build' ? colours.accentSubtle : colours.surface,
                          borderColor:
                            shelf.title === 'Build' ? colours.accentBorder : colours.border,
                          borderRadius: radius.large,
                          padding: spacing[4],
                          gap: spacing[2],
                        },
                      ]}>
                      <AppIcon name={module.icon} colour={colours.accent} />
                      <AppText variant="headline">{module.name}</AppText>
                      <AppText variant="caption" colour="textSecondary" numberOfLines={3}>
                        {module.description}
                      </AppText>
                      <AppText variant="caption" colour="accent">
                        {module.status}
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
            <AppText variant="label">Also explore</AppText>
            <AppPressable onPress={() => router.push('/product/agents' as Href)}>
              <AppText variant="body" colour="accent">
                Agents studio →
              </AppText>
            </AppPressable>
            <AppPressable onPress={() => router.push('/product/automations' as Href)}>
              <AppText variant="body" colour="accent">
                Automations studio →
              </AppText>
            </AppPressable>
            <AppPressable onPress={() => router.push('/product/widgets' as Href)}>
              <AppText variant="body" colour="accent">
                Widgets studio →
              </AppText>
            </AppPressable>
            <AppPressable onPress={() => router.push('/settings/extensions' as Href)}>
              <AppText variant="body" colour="accent">
                Extension Centre →
              </AppText>
            </AppPressable>
          </Surface>
        </ScrollView>
      </ResponsiveContent>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {flex: 1},
  actions: {},
  grid: {flexDirection: 'row', flexWrap: 'wrap'},
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    flexBasis: '47%',
    flexGrow: 1,
    minHeight: 150,
    minWidth: 150,
  },
  note: {borderWidth: StyleSheet.hairlineWidth, gap: 8},
})
