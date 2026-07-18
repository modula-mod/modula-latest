import {ScrollView, StyleSheet, View} from 'react-native'
import {LinearGradient} from 'expo-linear-gradient'
import {useRouter, type Href} from 'expo-router'

import {AppIcon} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import {INTELLIGENCE_LAYERS} from '@/features/product/data/intelligenceLayers'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function IntelligenceHubScreen() {
  const router = useRouter()
  const {colours, radius, spacing, scheme} = useThemeTokens()
  const wash =
    scheme === 'dark'
      ? ['#0B1416', colours.accentSubtle]
      : [colours.accentSubtle, colours.canvas]

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title="Intelligence" />
      <ResponsiveContent maxWidth={760}>
        <ScrollView contentContainerStyle={{gap: spacing[5], padding: spacing[4]}}>
          <LinearGradient
            colors={wash as [string, string]}
            style={[
              styles.hero,
              {
                borderRadius: radius.large,
                padding: spacing[5],
                gap: spacing[3],
                borderColor: colours.border,
              },
            ]}>
            <AppText variant="caption" colour="accent">
              CANONICAL MODEL
            </AppText>
            <AppText variant="display">GAIA executes. AKI verifies. Governor controls.</AppText>
            <AppText variant="body" colour="textSecondary">
              Modula is not one oversized AI chat button. Specialised layers share the Command Layer,
              module permissions, and an auditable Ledger. Preview surfaces below teach the
              architecture — production intelligence lands in Phase D.
            </AppText>
          </LinearGradient>

          <Surface
            variant="contained"
            style={[
              styles.flow,
              {
                padding: spacing[4],
                gap: spacing[2],
                borderRadius: radius.large,
                backgroundColor: colours.surface,
                borderColor: colours.border,
              },
            ]}>
            <AppText variant="caption" colour="textTertiary">
              REQUEST FLOW
            </AppText>
            <AppText variant="body" colour="textSecondary">
              GAIA plan → Command Layer → AKI check → Governor policy → user confirm → execute →
              Ledger → Kaizen
            </AppText>
          </Surface>

          <View style={[styles.grid, {gap: spacing[3]}]}>
            {INTELLIGENCE_LAYERS.map(layer => (
              <AppPressable
                key={layer.id}
                accessibilityLabel={layer.name}
                onPress={() => router.push(layer.route as Href)}
                style={[
                  styles.card,
                  {
                    backgroundColor: colours.surface,
                    borderColor: colours.border,
                    borderRadius: radius.large,
                    padding: spacing[4],
                    gap: spacing[2],
                  },
                ]}>
                <AppIcon name={layer.icon} colour={colours.accent} />
                <AppText variant="headline">{layer.name}</AppText>
                <AppText variant="caption" colour="accent">
                  {layer.interpretation}
                </AppText>
                <AppText variant="caption" colour="textSecondary">
                  {layer.role}
                </AppText>
                <AppText variant="micro" colour="textTertiary">
                  {layer.maturity}
                </AppText>
              </AppPressable>
            ))}
          </View>
        </ScrollView>
      </ResponsiveContent>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {flex: 1},
  hero: {borderWidth: StyleSheet.hairlineWidth, width: '100%'},
  flow: {borderWidth: StyleSheet.hairlineWidth},
  grid: {flexDirection: 'row', flexWrap: 'wrap'},
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    flexBasis: '47%',
    flexGrow: 1,
    minHeight: 160,
    minWidth: 150,
  },
})
