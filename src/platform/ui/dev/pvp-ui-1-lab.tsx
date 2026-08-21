import {useReducer, useState} from 'react'
import {StyleSheet, View} from 'react-native'

import {AppText} from '@/components/primitives/AppText'
import type {ModuleCatalogueItem} from '@/data/repositories/contracts'
import {ProductHubHeader} from '@/features/modules/components/ProductHubHeader'
import {ProductHubSearchChrome} from '@/features/modules/components/ProductHubSearchChrome'
import {ProductHubSegmentedControl, type ProductHubSegment} from '@/features/modules/components/ProductHubSegmentedControl'
import {
  ComingSoonRow,
  ModuleEditorialHero,
  ModuleRow,
  ModuleShelf,
} from '@/features/modules/components/presentation'
import {HubSectionHeader} from '@/features/modules/components/presentation/HubSectionHeader'
import {ModuleAction} from '@/features/modules/components/presentation/ModuleAction'
import {resolveModuleInstallPresentation} from '@/features/modules/identity/installPresentation'
import {
  initialProductHubSearch,
  reduceProductHubSearch,
} from '@/features/modules/state/productHubSearchMachine'
import {ModulaIcon} from '@/platform/ui/icons'
import {LiquidGlassChrome} from '@/platform/ui/materials/liquid-glass-chrome'
import {PvpUi1rLabBlocks} from '@/platform/ui/dev/pvp-ui-1r-lab'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const VAULT: ModuleCatalogueItem = {
  moduleId: 'digital.modula.vault-notes',
  name: 'Vault Notes',
  description: 'Private notes and saved knowledge.',
  publisherName: 'Modula',
  publisherId: 'modula',
  kind: 'module',
  category: 'Productivity',
  featured: true,
  installable: true,
  installationState: 'available',
  priceState: 'Free',
  trustLevel: 'firstParty',
  latestVersion: '1.1.0',
  compatibility: 'Compatible',
}

const TASKS: ModuleCatalogueItem = {
  ...VAULT,
  moduleId: 'digital.modula.tasks',
  name: 'Tasks',
  featured: false,
  installable: false,
  installationState: 'comingSoon',
  priceState: 'Coming soon',
}

function LabBlock({title, children}: {title: string; children: React.ReactNode}) {
  const {spacing} = useThemeTokens()
  return (
    <View style={{gap: spacing[3]}} testID={`ui-lab-${title.replace(/\s+/g, '-').toLowerCase()}`}>
      <AppText variant="headline">{title}</AppText>
      {children}
    </View>
  )
}

/** PVP-UI-1 Product Hub specimens. Lives in the existing Modula UI Lab. */
export function PvpUi1LabBlocks() {
  const {colours, spacing, radius} = useThemeTokens()
  const [hubSearch, dispatchHubSearch] = useReducer(reduceProductHubSearch, initialProductHubSearch)
  const [segment, setSegment] = useState<ProductHubSegment>('discover')
  const settle = () => {
    if (hubSearch.state === 'SEARCH_EXPANDING') dispatchHubSearch({type: 'GEOMETRY_SETTLED'})
    if (hubSearch.state === 'SEARCH_COLLAPSING') dispatchHubSearch({type: 'COLLAPSE_COMPLETE'})
  }

  return (
    <View style={{gap: spacing[5]}}>
      <PvpUi1rLabBlocks />
      <AppText variant="title1">PVP-UI-1 Product Hub</AppText>
      <AppText variant="body" colour="textSecondary">
        Native editorial marketplace specimens. Not a second UI Lab.
      </AppText>

      <LabBlock title="ProductHubHeader">
        <View style={[styles.frame, {backgroundColor: colours.canvas, padding: spacing[3]}]}>
          <ProductHubHeader
            compact={false}
            search={hubSearch}
            profileName="Founder"
            segment={segment}
            onSegmentChange={setSegment}
            wide={false}
            onSearchTrigger={() => dispatchHubSearch({type: 'TAP_SEARCH'})}
            onSearchChange={query => dispatchHubSearch({type: 'TYPE', query})}
            onSearchCancel={() => dispatchHubSearch({type: 'CANCEL'})}
            onSearchSettled={settle}
            onProfilePress={() => undefined}
          />
        </View>
      </LabBlock>

      <LabBlock title="ProductHubSearch">
        <ProductHubSearchChrome
          model={initialProductHubSearch}
          compact={false}
          onTrigger={() => undefined}
          onChangeText={() => undefined}
          onCancel={() => undefined}
          onSettled={() => undefined}
        />
      </LabBlock>

      <LabBlock title="ProductHubSearchActive">
        <ProductHubSearchChrome
          model={{state: 'SEARCH_ACTIVE', query: 'vault', compact: false}}
          compact={false}
          onTrigger={() => undefined}
          onChangeText={() => undefined}
          onCancel={() => undefined}
          onSettled={() => undefined}
        />
      </LabBlock>

      <LabBlock title="EditorialFeature">
        <ModuleEditorialHero item={VAULT} onPress={() => undefined} onAction={() => undefined} />
      </LabBlock>

      <LabBlock title="ModuleRow">
        <ModuleRow item={VAULT} onPress={() => undefined} />
      </LabBlock>

      <LabBlock title="ModuleShelf">
        <ModuleShelf title="Made by Modula" items={[VAULT, TASKS]} onOpen={() => undefined} />
      </LabBlock>

      <LabBlock title="SectionHeader">
        <HubSectionHeader title="New for Modula" icon="download" trailing="See All" />
      </LabBlock>

      <LabBlock title="ComingSoonRow">
        <ComingSoonRow item={TASKS} onPress={() => undefined} showSeparator={false} />
      </LabBlock>

      <LabBlock title="InstallButton">
        <ModuleAction
          presentation={resolveModuleInstallPresentation(VAULT)}
          productName="Vault Notes"
          onPress={() => undefined}
        />
      </LabBlock>

      <LabBlock title="ProductHubSegmentedControl">
        <ProductHubSegmentedControl value={segment} onChange={setSegment} />
      </LabBlock>

      <LabBlock title="GlassToolbar">
        <LiquidGlassChrome
          interactive
          fallback="regular"
          contentLayout="flow"
          style={[styles.toolbar, {borderRadius: radius.round, paddingHorizontal: spacing[2]}]}>
          <View style={[styles.toolbarRow, {gap: spacing[2]}]}>
            <ModulaIcon name="search" size={18} colour={colours.text} />
            <AppText variant="buttonLabel">Search</AppText>
          </View>
        </LiquidGlassChrome>
      </LabBlock>
    </View>
  )
}

const styles = StyleSheet.create({
  frame: {overflow: 'hidden'},
  toolbar: {alignSelf: 'flex-start', minHeight: 44},
  toolbarRow: {alignItems: 'center', flexDirection: 'row', minHeight: 44, paddingHorizontal: 8},
})
