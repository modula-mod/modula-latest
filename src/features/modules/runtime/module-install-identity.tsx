import {View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {AppText} from '@/components/primitives/AppText'
import {ModuleArtwork, ModuleArtworkTitle} from '@/features/modules/components/ModuleArtwork'
import {resolveModuleInstallPresentation} from '@/features/modules/identity/installPresentation'
import type {ModuleDetail} from '@/data/repositories/contracts'
import {ModulaButton} from '@/platform/ui/buttons/modula-button'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

/**
 * Hosted route for a catalogue module that is not installed yet.
 * PRESENTATION_BUG fix: this must never read as “Permission required”.
 */
export function ModuleInstallIdentity({
  module,
  onInstall,
}: {
  module: ModuleDetail
  onInstall?: () => void
}) {
  const router = useRouter()
  const {spacing} = useThemeTokens()
  const presentation = resolveModuleInstallPresentation(module)
  const openMarketplace = () =>
    router.push(`/marketplace/${encodeURIComponent(module.moduleId)}` as Href)

  return (
    <View style={{gap: spacing[4], padding: spacing[4]}} testID="module-install-identity">
      <ModuleArtwork moduleId={module.moduleId} name={module.name} size={120} variant="hero" />
      <ModuleArtworkTitle moduleId={module.moduleId} name={module.name} />
      <AppText variant="label">{presentation.customerStatus}</AppText>
      <ModulaButton
        label={presentation.primaryAction === 'Install' ? 'Install' : presentation.primaryAction}
        accessibilityLabel={`${presentation.primaryAction} ${module.name}`}
        disabled={!presentation.installable}
        onPress={onInstall ?? openMarketplace}
      />
      {presentation.primaryAction === 'Install' ? (
        <ModulaButton
          label="Review on Product Hub"
          role="secondary"
          accessibilityLabel={`Review ${module.name} on Product Hub`}
          onPress={openMarketplace}
        />
      ) : null}
    </View>
  )
}
