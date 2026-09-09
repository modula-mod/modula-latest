import {useState} from 'react'
import {ScrollView, StyleSheet, View} from 'react-native'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import type {ModuleCatalogueItem} from '@/data/repositories/contracts'
import {useHydrationSafeWindowDimensions} from '@/lib/useHydrationSafeWindowDimensions'
import {
  ComingSoonEditorial,
  EditorialBleedHero,
  EditorialSplitHero,
  HubSectionHeader,
  ModuleBrowseGrid,
  ModuleEditorialHero,
  ModuleIconShelf,
  ModuleRow,
} from '@/features/modules/components/presentation'
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

type Direction = 'A' | 'B' | 'C'

/**
 * Three genuinely different Product Hub directions. Isolated lab surface.
 * Direction A is implemented on the live Product Hub after comparison.
 */
export function PvpUi1rLabBlocks() {
  const {colours, spacing} = useThemeTokens()
  const {width} = useHydrationSafeWindowDimensions()
  const desktop = width >= 960
  const [direction, setDirection] = useState<Direction>('A')

  return (
    <View style={{gap: spacing[4]}} testID="pvp-ui-1r-directions">
      <AppText variant="title1">PVP-UI-1R directions</AppText>
      <AppText variant="body" colour="textSecondary">
        Research-backed reconstructions. Not founder-approved. Direction A is the agent recommendation.
      </AppText>
      <View style={styles.switcher}>
        {(['A', 'B', 'C'] as Direction[]).map(value => (
          <AppPressable
            key={value}
            accessibilityLabel={`Direction ${value}`}
            onPress={() => setDirection(value)}
            style={[
              styles.chip,
              {
                borderColor: colours.separator,
                backgroundColor: direction === value ? colours.surfaceRaised : 'transparent',
              },
            ]}>
            <AppText variant="buttonLabel">{value}</AppText>
          </AppPressable>
        ))}
      </View>

      {direction === 'A' ? <DirectionA desktop={desktop} /> : null}
      {direction === 'B' ? <DirectionB desktop={desktop} /> : null}
      {direction === 'C' ? <DirectionC desktop={desktop} /> : null}
    </View>
  )
}

function DirectionA({desktop}: {desktop: boolean}) {
  const {spacing} = useThemeTokens()
  return (
    <View testID="pvp-ui-1r-direction-a" style={{gap: spacing[5]}}>
      <AppText variant="headline">A — Editorial Story</AppText>
      <ModuleEditorialHero item={VAULT} onPress={() => undefined} onAction={() => undefined} />
      <View style={desktop ? styles.split : undefined}>
        <View style={desktop ? styles.column : undefined}>
          <HubSectionHeader title="New for Modula" subtitle="Fresh tools for your digital world" trailing="See All" />
          <ModuleRow item={VAULT} onPress={() => undefined} showSeparator={false} />
        </View>
        <View style={desktop ? styles.column : undefined}>
          <ModuleIconShelf title="Made by Modula" subtitle="Essential modules" items={[VAULT, TASKS]} onOpen={() => undefined} />
        </View>
      </View>
      <ComingSoonEditorial item={TASKS} onPress={() => undefined} />
      <HubSectionHeader title="Browse" />
      <ModuleBrowseGrid onBrowse={() => undefined} />
    </View>
  )
}

function DirectionB({desktop}: {desktop: boolean}) {
  const {spacing} = useThemeTokens()
  return (
    <View testID="pvp-ui-1r-direction-b" style={{gap: spacing[5]}}>
      <AppText variant="headline">B — Full-Bleed Feature</AppText>
      <EditorialBleedHero item={VAULT} onPress={() => undefined} onAction={() => undefined} />
      <HubSectionHeader title="Must-play modules" trailing="See All" />
      <ModuleRow item={VAULT} onPress={() => undefined} />
      <ModuleRow item={TASKS} onPress={() => undefined} showSeparator={false} />
      {desktop ? (
        <View style={styles.split}>
          <View style={styles.column}>
            <ComingSoonEditorial item={TASKS} onPress={() => undefined} />
          </View>
          <View style={styles.column}>
            <HubSectionHeader title="Browse" />
            <ModuleBrowseGrid onBrowse={() => undefined} />
          </View>
        </View>
      ) : (
        <>
          <ComingSoonEditorial item={TASKS} onPress={() => undefined} />
          <ModuleBrowseGrid onBrowse={() => undefined} />
        </>
      )}
    </View>
  )
}

function DirectionC({desktop}: {desktop: boolean}) {
  const {spacing} = useThemeTokens()
  return (
    <View testID="pvp-ui-1r-direction-c" style={{gap: spacing[5]}}>
      <AppText variant="headline">C — Editorial Split</AppText>
      <EditorialSplitHero item={VAULT} onPress={() => undefined} onAction={() => undefined} />
      <ModuleIconShelf title="Made by Modula" items={[VAULT, TASKS]} onOpen={() => undefined} />
      <View style={desktop ? styles.split : undefined}>
        <View style={desktop ? styles.column : undefined}>
          <HubSectionHeader title="Ranked" subtitle="From the live catalogue" />
          <ModuleRow item={VAULT} onPress={() => undefined} showSeparator={false} />
        </View>
        <View style={desktop ? styles.column : undefined}>
          <ComingSoonEditorial item={TASKS} onPress={() => undefined} />
        </View>
      </View>
    </View>
  )
}

export function PvpUi1rDirectionPreview({direction}: {direction: Direction}) {
  return (
    <ScrollView testID={`pvp-ui-1r-preview-${direction.toLowerCase()}`}>
      {direction === 'A' ? <DirectionA desktop /> : null}
      {direction === 'B' ? <DirectionB desktop /> : null}
      {direction === 'C' ? <DirectionC desktop /> : null}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 36,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  column: {flex: 1, minWidth: 280},
  split: {flexDirection: 'row', flexWrap: 'wrap', gap: 24},
  switcher: {flexDirection: 'row', gap: 8},
})
