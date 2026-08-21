import {useLocalSearchParams} from 'expo-router'

import {
  SettingsCaption,
  SettingsScreen,
} from '@/features/settings/components/SettingsRows'
import {AppText} from '@/components/primitives/AppText'
import {canAccessDeveloperLabs} from '@/lib/platform'
import {
  ModulaPrimitivesLabScreen,
  ProductHeroLabScreen,
} from '@/platform/ui/dev/modula-primitives-lab'

export function ModulaUiLabRouteScreen() {
  const {installReview, productHero} = useLocalSearchParams<{
    installReview?: string
    productHero?: string
  }>()
  if (!canAccessDeveloperLabs()) {
    return (
      <SettingsScreen title="Modula UI Lab">
        <AppText variant="headline">Developer settings are unavailable.</AppText>
        <SettingsCaption>This surface is only available in development and preview builds.</SettingsCaption>
      </SettingsScreen>
    )
  }
  if (productHero === '1') return <ProductHeroLabScreen />
  return (
    <SettingsScreen title="Modula UI Lab" caption="UI Lab 2.0 — quality compare plus flagship primitive matrix for Direction M.">
      <ModulaPrimitivesLabScreen initialInstallReviewOpen={installReview === '1'} />
    </SettingsScreen>
  )
}
