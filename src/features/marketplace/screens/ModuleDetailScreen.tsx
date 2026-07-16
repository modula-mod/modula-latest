import {ScrollView, StyleSheet, View} from 'react-native'
import {useLocalSearchParams, useRouter, type Href} from 'expo-router'

import {AppIcon} from '@/components/primitives/AppIcon'
import {AppText} from '@/components/primitives/AppText'
import {EmptyState} from '@/components/primitives/EmptyState'
import {Surface} from '@/components/primitives/Surface'
import {
  getMarketplaceModule,
  getMarketplaceSeller,
} from '@/features/marketplace/data/catalog'
import {ModulaButton} from '@/platform/ui/buttons/modula-button'
import {confirmModulaAction} from '@/platform/ui/menus/confirmModulaAction'
import {ModulaControlGroup} from '@/platform/ui/menus/modula-control-group'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function ModuleDetailScreen() {
  const {moduleId} = useLocalSearchParams<{moduleId: string}>()
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()
  const module = getMarketplaceModule(String(moduleId ?? ''))
  const seller = module ? getMarketplaceSeller(module.sellerId) : undefined

  if (!module) {
    return (
      <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
        <SecondaryScreenHeader title="Module" />
        <EmptyState
          icon="marketplace"
          title="Module not found"
          description="This marketplace preview item is not in the seeded catalog."
        />
      </View>
    )
  }

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title={module.name} />
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
              <AppIcon name={module.icon} colour={colours.accent} size={28} />
            </View>
            <View style={styles.flex}>
              <AppText variant="display">{module.name}</AppText>
              <AppText variant="body" colour="textSecondary">
                {module.description}
              </AppText>
              <AppText variant="caption" colour="accent">
                {module.status} · {module.capability}
              </AppText>
            </View>
          </Surface>

          <View style={{gap: spacing[2]}}>
            <AppText variant="headline">About</AppText>
            <AppText variant="body" colour="textSecondary">
              {module.longDescription}
            </AppText>
          </View>

          <View style={{gap: spacing[2]}}>
            <AppText variant="headline">Capability</AppText>
            <AppText variant="body" colour="textSecondary">
              {module.capability}
            </AppText>
            <AppText variant="caption" colour="textTertiary">
              Tags: {module.tags.join(' · ')}
            </AppText>
          </View>

          {seller ? (
            <ModulaButton
              label={`Creator · @${seller.handle}`}
              role="secondary"
              onPress={() => router.push(`/marketplace/seller/${seller.id}` as Href)}
            />
          ) : null}

          <ModulaControlGroup
            label="Module actions"
            systemImage="ellipsis.circle"
            actions={[
              {id: 'install', label: 'Install Preview', systemImage: 'arrow.down.app'},
              {id: 'edit', label: 'Edit', systemImage: 'pencil'},
              {
                id: 'remove',
                label: 'Remove Preview',
                systemImage: 'trash',
                style: 'destructive',
              },
            ]}
            onAction={id => {
              if (id === 'install') {
                void confirmModulaAction({
                  title: 'Install Preview',
                  message:
                    `${module.name} will not be installed on a production backend. Local Phase 4.5 Preview only.`,
                  confirmLabel: 'Acknowledge preview',
                  cancelLabel: 'Cancel',
                })
                return
              }
              void confirmModulaAction({
                title: id === 'remove' ? 'Remove Preview' : 'Edit Preview',
                message: 'This marketplace action is local Preview only.',
                confirmLabel: 'OK',
                cancelLabel: 'Cancel',
              })
            }}
          />
          <AppText variant="caption" colour="textSecondary">
            Preview — no remote install, billing, or permissions are granted.
          </AppText>
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
    gap: 6,
    minWidth: 0,
  },
  hero: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  icon: {
    alignItems: 'center',
    height: 64,
    justifyContent: 'center',
    width: 64,
  },
  screen: {
    flex: 1,
  },
})
