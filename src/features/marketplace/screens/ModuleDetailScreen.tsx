import {ScrollView, StyleSheet, View} from 'react-native'
import {useLocalSearchParams, useRouter, type Href} from 'expo-router'

import {AppText} from '@/components/primitives/AppText'
import {EmptyState} from '@/components/primitives/EmptyState'
import {
  getMarketplaceModule,
  getMarketplaceSeller,
} from '@/features/marketplace/data/catalog'
import {ModulePreScreenHero} from '@/features/modules/screens/ModulePreScreen'
import {ModulaButton} from '@/platform/ui/buttons/modula-button'
import {confirmModulaAction} from '@/platform/ui/menus/confirmModulaAction'
import {ModulaControlGroup} from '@/platform/ui/menus/modula-control-group'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function ModuleDetailScreen() {
  const {moduleId} = useLocalSearchParams<{moduleId: string}>()
  const router = useRouter()
  const {colours, spacing} = useThemeTokens()
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
          <ModulePreScreenHero module={module} />

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
              {id: 'registry', label: 'Open Extension Centre', systemImage: 'puzzlepiece'},
              {
                id: 'remove',
                label: 'Remove Preview',
                systemImage: 'trash',
                style: 'destructive',
              },
            ]}
            onAction={id => {
              if (id === 'registry') {
                router.push('/settings/extensions' as Href)
                return
              }
              if (id === 'install') {
                void confirmModulaAction({
                  title: 'Install Preview',
                  message:
                    `${module.name} preview does not download or execute package code yet. Registry runtime arrives with the module standard.`,
                  confirmLabel: 'Acknowledge preview',
                  cancelLabel: 'Cancel',
                })
                return
              }
              void confirmModulaAction({
                title: 'Remove Preview',
                message: 'This marketplace action is local Preview only.',
                confirmLabel: 'OK',
                cancelLabel: 'Cancel',
              })
            }}
          />
          <AppText variant="caption" colour="textSecondary">
            Honest preview — no remote billing, and no untrusted code execution from GitHub.
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
  screen: {
    flex: 1,
  },
})
