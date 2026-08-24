import {ScrollView, StyleSheet, View} from 'react-native'

import {AppText} from '@/components/primitives/AppText'
import {ProductHubSearchChrome} from '@/features/modules/components/ProductHubSearchChrome'
import {ProductHubSegmentedControl} from '@/features/modules/components/ProductHubSegmentedControl'
import {initialProductHubSearch} from '@/features/modules/state/productHubSearchMachine'
import {ModulaIcon} from '@/platform/ui/icons'
import {LiquidGlassChrome} from '@/platform/ui/materials/liquid-glass-chrome'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type Experiment = {
  api: string
  decision: 'ADOPT' | 'ADAPT' | 'DEFER' | 'REJECT'
  detail: string
}

const EXPERIMENTS: Experiment[] = [
  {
    api: 'Stack.Screen.Title / large title',
    decision: 'ADAPT',
    detail: 'Native large titles work, but Product Hub needs avatar + morphing search + Surface Types. ProductHubHeader is the contract.',
  },
  {
    api: 'Stack.SearchBar',
    decision: 'REJECT',
    detail: 'SDK 57 types force headerShown. Rejected as Product Hub chrome. Compact glass morph is the adapted production search.',
  },
  {
    api: 'ModulaSegmentedPicker / Expo UI segmented',
    decision: 'ADAPT',
    detail: 'Kept for wide library chrome. Rejected as a stacked utility block under search. Narrow web uses a full-label popover so Discover never truncates.',
  },
  {
    api: 'Stack.Toolbar.SearchBarSlot',
    decision: 'REJECT',
    detail: 'Conflicts with Modula floating tab bar. Evaluated in this lab; Product Hub keeps compact glass search in the header.',
  },
  {
    api: 'expo-glass-effect GlassView',
    decision: 'ADAPT',
    detail: 'Chrome only: compact search trigger. Content stays on canvas. Reduce Transparency falls back to opaque.',
  },
  {
    api: 'Link.AppleZoom',
    decision: 'ADAPT',
    detail: 'Featured artwork → Module Detail cover only. Rows keep a standard push.',
  },
  {
    api: 'NativeTabs (unstable-native-tabs)',
    decision: 'DEFER',
    detail: 'Still alpha. Do not replace Home/Profile/Activity in PVP-UI-1. Shell phase later.',
  },
  {
    api: 'expo-router/ui custom tabs',
    decision: 'ADAPT',
    detail: 'Better fit for Modula’s floating tab identity in the later Shell phase.',
  },
  {
    api: 'Animated SF Symbols',
    decision: 'ADAPT',
    detail: 'Install confirmation only. Not decorative icon motion.',
  },
]

/** Internal-only SDK 57 comparison. Not a production route. */
export function PvpNativeExperimentsScreen() {
  const {colours, spacing, radius} = useThemeTokens()
  return (
    <ScrollView
      testID="pvp-native-experiments"
      contentContainerStyle={[styles.content, {gap: spacing[5], padding: spacing[4]}]}>
      <AppText variant="display">Native navigation experiments</AppText>
      <AppText variant="body" colour="textSecondary">
        Installed Expo Router 57.0.15 and @expo/ui 57.0.12. Decisions are recorded in docs/research/pvp-ui-1r-native-experiments.md.
      </AppText>

      {EXPERIMENTS.map(item => (
        <View
          key={item.api}
          style={[styles.card, {borderColor: colours.separator, padding: spacing[3], gap: spacing[1]}]}>
          <AppText variant="label">{item.api}</AppText>
          <AppText variant="caption" colour="accent">
            {item.decision}
          </AppText>
          <AppText variant="caption" colour="textSecondary">
            {item.detail}
          </AppText>
        </View>
      ))}

      <AppText variant="headline">Live adapters</AppText>
      <ProductHubSegmentedControl value="discover" onChange={() => undefined} />
      <ProductHubSearchChrome
        model={initialProductHubSearch}
        compact={false}
        onTrigger={() => undefined}
        onChangeText={() => undefined}
        onCancel={() => undefined}
        onSettled={() => undefined}
      />
      <LiquidGlassChrome
        interactive
        fallback="regular"
        style={{alignSelf: 'flex-start', borderRadius: radius.round, height: 44, width: 44}}>
        <View style={styles.disc}>
          <ModulaIcon name="search" size={18} colour={colours.text} />
        </View>
      </LiquidGlassChrome>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  card: {borderRadius: 12, borderWidth: StyleSheet.hairlineWidth},
  content: {paddingBottom: 48},
  disc: {alignItems: 'center', flex: 1, justifyContent: 'center'},
})
