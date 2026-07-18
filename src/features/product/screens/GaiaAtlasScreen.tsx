import {ScrollView, StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {AppButton} from '@/components/primitives/AppButton'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useFloatingTabBarContentPadding} from '@/platform/ui/navigation/floating-tab-bar-inset'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const NODES = [
  {id: 'aki', label: 'AKI', x: '8%', y: 28},
  {id: 'governor', label: 'Governor', x: '68%', y: 28},
  {id: 'memory', label: 'Circuit Memory', x: '34%', y: 88},
  {id: 'claims', label: 'Claims', x: '12%', y: 158},
  {id: 'ledger', label: 'Ledger', x: '66%', y: 158},
  {id: 'commands', label: 'Commands', x: '18%', y: 228},
  {id: 'foundry', label: 'Foundry', x: '58%', y: 228},
  {id: 'kaizen', label: 'Kaizen', x: '38%', y: 288},
]

export function GaiaAtlasScreen() {
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()
  const tabPadding = useFloatingTabBarContentPadding()

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title="Gaia Atlas" />
      <ResponsiveContent maxWidth={720}>
        <ScrollView contentContainerStyle={{gap: spacing[5], padding: spacing[4], paddingBottom: tabPadding}}>
          <View style={{gap: spacing[2]}}>
            <AppText variant="caption" colour="accent">
              VISUAL INTELLIGENCE ARCHITECTURE
            </AppText>
            <AppText variant="display">Map the governed system.</AppText>
            <AppText variant="body" colour="textSecondary">
              Gaia Atlas (formerly Neural Atlas) is an internal module Preview for agents, models,
              modules, skills, claims, memory paths, decisions, and training lineage. Ships after
              Shell, social, module standard, Notes, Tasks, and CRM.
            </AppText>
          </View>

          <Surface
            variant="contained"
            style={[
              styles.map,
              {
                borderRadius: radius.large,
                backgroundColor: colours.surface,
                borderColor: colours.border,
                height: 360,
              },
            ]}>
            {NODES.map(node => (
              <View
                key={node.id}
                style={[
                  styles.node,
                  {
                    left: node.x as `${number}%`,
                    top: node.y,
                    backgroundColor: colours.accentSubtle,
                    borderColor: colours.accent,
                    borderRadius: radius.round,
                    paddingHorizontal: spacing[3],
                    paddingVertical: spacing[2],
                  },
                ]}>
                <AppText variant="caption" colour="accent">
                  {node.label}
                </AppText>
              </View>
            ))}
            <View style={[styles.centre, {borderColor: colours.accent}]}>
              <AppText variant="label" colour="accent">
                GAIA
              </AppText>
            </View>
          </Surface>

          <AppText variant="caption" colour="textTertiary">
            Centre = execution. Orbit = verification, governance, memory, evidence, audit, and
            improvement. Schematic only — no live graph runtime.
          </AppText>

          <AppButton onPress={() => router.push('/product/gaia' as Href)}>Open GAIA</AppButton>
          <AppButton variant="secondary" onPress={() => router.push('/product/intelligence' as Href)}>
            Intelligence Hub
          </AppButton>
          <AppButton variant="ghost" onPress={() => router.push('/product/aki' as Href)}>
            AKI
          </AppButton>
          <AppButton variant="ghost" onPress={() => router.push('/product/governor' as Href)}>
            AGI Governor
          </AppButton>
        </ScrollView>
      </ResponsiveContent>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {flex: 1},
  map: {
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
  },
  node: {
    borderWidth: StyleSheet.hairlineWidth,
    position: 'absolute',
  },
  centre: {
    alignItems: 'center',
    alignSelf: 'center',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    height: 72,
    justifyContent: 'center',
    marginTop: 124,
    width: 72,
  },
})
