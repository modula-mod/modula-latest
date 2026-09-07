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
import {PvpUi1LabBlocks} from '@/platform/ui/dev/pvp-ui-1-lab'
import {WebUiAdapterLab} from '@/platform/ui/dev/web-ui-adapter-lab'

export function ModulaUiLabRouteScreen() {
  const {installReview, productHero, productOverview} = useLocalSearchParams<{
    installReview?: string
    productHero?: string
    productOverview?: string
  }>()
  if (!canAccessDeveloperLabs()) {
    return (
      <SettingsScreen title="Modula UI Lab">
        <AppText variant="headline">Developer settings are unavailable.</AppText>
        <SettingsCaption>This surface is only available in development and preview builds.</SettingsCaption>
      </SettingsScreen>
    )
  }
  if (productHero === '1') {
    return <ProductHeroLabScreen initialOverviewOffset={productOverview === '1'} />
  }
  return (
    <SettingsScreen title="Modula UI Lab" caption="UI Lab 2.0 — semantic primitives, Web Adapter V1, and Product Hub specimens.">
      <WebUiAdapterLab />
      <PvpUi1LabBlocks />
      <ModulaPrimitivesLabScreen initialInstallReviewOpen={installReview === '1'} />
    </SettingsScreen>
  )
}
