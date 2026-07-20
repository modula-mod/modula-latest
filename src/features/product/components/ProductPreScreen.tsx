import {ScrollView, StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'
import {LinearGradient} from 'expo-linear-gradient'
import {useSafeAreaInsets} from 'react-native-safe-area-context'

import {AppButton} from '@/components/primitives/AppButton'
import {AppIcon} from '@/components/primitives/AppIcon'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import type {ProductCapability, ProductMaturity} from '@/features/product/data/productCatalogue'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const MATURITY_LABEL: Record<ProductMaturity, string> = {
  live: 'Live',
  preview: 'Preview',
  planned: 'Planned',
  inactive: 'Inactive',
}

export function ProductPreScreen({capability}: {capability: ProductCapability}) {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const {colours, radius, spacing, scheme} = useThemeTokens()
  const wash =
    scheme === 'dark'
      ? ['#0B1416', colours.accentSubtle]
      : [colours.accentSubtle, colours.canvas]

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title={capability.name} />
      <ResponsiveContent maxWidth={720}>
        <ScrollView
          contentContainerStyle={{
            gap: spacing[5],
            padding: spacing[4],
            paddingBottom: insets.bottom + spacing[8],
          }}>
          <LinearGradient
            colors={wash as [string, string]}
            style={[styles.hero, {borderRadius: radius.large, padding: spacing[5], gap: spacing[3]}]}>
            <View style={[styles.heroTop, {gap: spacing[3]}]}>
              <View
                style={[
                  styles.icon,
                  {
                    backgroundColor: colours.surface,
                    borderColor: colours.border,
                    borderRadius: radius.large,
                  },
                ]}>
                <AppIcon name={capability.icon} colour={colours.accent} size={28} />
              </View>
              <View style={{flex: 1, gap: spacing[1]}}>
                <AppText variant="caption" colour="accent">
                  {capability.eyebrow} · {MATURITY_LABEL[capability.maturity].toUpperCase()}
                </AppText>
                <AppText variant="display">{capability.name}</AppText>
              </View>
            </View>
            <AppText variant="title2">{capability.summary}</AppText>
            <AppText variant="body" colour="textSecondary">
              {capability.body}
            </AppText>
          </LinearGradient>

          <View style={{gap: spacing[2]}}>
            <AppText variant="headline">Includes</AppText>
            {capability.bullets.map(bullet => (
              <Surface
                key={bullet}
                variant="contained"
                style={[
                  styles.bullet,
                  {
                    borderColor: colours.border,
                    borderRadius: radius.medium,
                    padding: spacing[3],
                    gap: spacing[2],
                    backgroundColor: colours.surface,
                  },
                ]}>
                <AppIcon name="check" colour={colours.accent} size={16} />
                <AppText variant="body">{bullet}</AppText>
              </Surface>
            ))}
          </View>

          {capability.pipeline ? (
            <Surface
              variant="contained"
              style={[
                styles.pipeline,
                {
                  gap: spacing[2],
                  padding: spacing[4],
                  borderRadius: radius.medium,
                  backgroundColor: colours.surfaceRaised,
                  borderColor: colours.border,
                },
              ]}>
              <AppText variant="label">Pipeline</AppText>
              <AppText variant="body" colour="textSecondary">
                {capability.pipeline}
              </AppText>
            </Surface>
          ) : null}

          {capability.maturity === 'inactive' || capability.maturity === 'planned' ? (
            <AppText variant="caption" colour="textTertiary">
              Honest preview — this surface explains direction. It does not fake live data, balances,
              or untrusted code execution.
            </AppText>
          ) : null}

          <View style={{gap: spacing[3]}}>
            {capability.ctaLabel && capability.ctaRoute ? (
              <AppButton onPress={() => router.push(capability.ctaRoute as Href)}>
                {capability.ctaLabel}
              </AppButton>
            ) : null}
            {capability.secondaryLabel && capability.secondaryRoute ? (
              <AppButton
                variant="secondary"
                onPress={() => router.push(capability.secondaryRoute as Href)}>
                {capability.secondaryLabel}
              </AppButton>
            ) : null}
            <AppButton variant="ghost" onPress={() => router.push('/product' as Href)}>
              All Modula capabilities
            </AppButton>
          </View>
        </ScrollView>
      </ResponsiveContent>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {flex: 1},
  hero: {width: '100%'},
  heroTop: {alignItems: 'center', flexDirection: 'row'},
  icon: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    height: 64,
    justifyContent: 'center',
    width: 64,
  },
  bullet: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
  },
  pipeline: {borderWidth: StyleSheet.hairlineWidth},
})
