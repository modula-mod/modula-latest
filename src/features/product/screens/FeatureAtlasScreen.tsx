import {useMemo, useState} from 'react'
import {ScrollView, StyleSheet, TextInput, View} from 'react-native'
import {useLocalSearchParams, useRouter, type Href} from 'expo-router'

import {AppIcon} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {
  ATLAS_DOMAIN_LABELS,
  ATLAS_DOMAINS,
  ATLAS_MATURITY_COUNTS,
  FEATURE_ATLAS,
  atlasSearch,
  isFeatureDomain,
  isFeatureMaturity,
  type AtlasFeature,
  type FeatureDomain,
  type FeatureMaturity,
} from '@/features/product/data/featureAtlas'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type MaturityFilter = FeatureMaturity | 'all'
type DomainFilter = FeatureDomain | 'all'

const MATURITY_FILTERS: MaturityFilter[] = ['all', 'live', 'preview', 'planned', 'inactive']
const MATURITY_LABELS: Record<MaturityFilter, string> = {
  all: 'All',
  live: 'Live',
  preview: 'Preview',
  planned: 'Planned',
  inactive: 'Inactive',
}

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? ''
}

function maturityCopy(maturity: FeatureMaturity): string {
  if (maturity === 'live') return 'Live surface'
  if (maturity === 'preview') return 'Preview, not production runtime'
  if (maturity === 'planned') return 'Planned capability'
  return 'Inactive by design'
}

export function FeatureAtlasScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{domain?: string; maturity?: string}>()
  const {colours, radius, spacing} = useThemeTokens()
  const domainParam = firstParam(params.domain)
  const maturityParam = firstParam(params.maturity)
  const [query, setQuery] = useState('')
  const [domain, setDomain] = useState<DomainFilter>(
    isFeatureDomain(domainParam) ? domainParam : 'all',
  )
  const [maturity, setMaturity] = useState<MaturityFilter>(
    isFeatureMaturity(maturityParam) ? maturityParam : 'all',
  )

  const filtered = useMemo(() => {
    const searched = query.trim() ? atlasSearch(query) : FEATURE_ATLAS
    return searched.filter(feature => {
      const domainMatches = domain === 'all' || feature.domain === domain
      const maturityMatches = maturity === 'all' || feature.maturity === maturity
      return domainMatches && maturityMatches
    })
  }, [domain, maturity, query])

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title="Feature Atlas" />
      <ResponsiveContent maxWidth={840}>
        <ScrollView contentContainerStyle={{gap: spacing[5], padding: spacing[4]}}>
          <View
            style={[
              styles.hero,
              {
                backgroundColor: colours.surface,
                borderColor: colours.accentBorder,
                borderRadius: radius.large,
                padding: spacing[5],
                gap: spacing[3],
              },
            ]}>
            <AppText variant="caption" colour="accent">
              FEATURE ATLAS / {FEATURE_ATLAS.length} NAMED CAPABILITIES
            </AppText>
            <AppText variant="display">A map of Modula's surface area.</AppText>
            <AppText variant="body" colour="textSecondary">
              Atlas maps Modula’s surface area. Preview ≠ production runtime.
            </AppText>
            <View style={[styles.statsRow, {gap: spacing[2]}]}>
              {(Object.keys(ATLAS_MATURITY_COUNTS) as FeatureMaturity[]).map(key => (
                <View
                  key={key}
                  style={[
                    styles.statPill,
                    {
                      backgroundColor: colours.accentSubtle,
                      borderColor: colours.accentBorder,
                      borderRadius: radius.full,
                      paddingHorizontal: spacing[3],
                      paddingVertical: spacing[2],
                    },
                  ]}>
                  <AppText variant="caption" colour="accent">
                    {MATURITY_LABELS[key]} {ATLAS_MATURITY_COUNTS[key]}
                  </AppText>
                </View>
              ))}
            </View>
          </View>

          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search atlas features, domains, tags..."
            placeholderTextColor={colours.textTertiary}
            accessibilityLabel="Search Feature Atlas"
            style={[
              styles.input,
              {
                backgroundColor: colours.surface,
                borderColor: colours.border,
                borderRadius: radius.medium,
                color: colours.text,
                paddingHorizontal: spacing[4],
              },
            ]}
          />

          <View style={{gap: spacing[3]}}>
            <AppText variant="headline">Maturity</AppText>
            <View style={[styles.chipWrap, {gap: spacing[2]}]}>
              {MATURITY_FILTERS.map(item => {
                const active = item === maturity
                return (
                  <AppPressable
                    key={item}
                    accessibilityLabel={`Filter maturity ${MATURITY_LABELS[item]}`}
                    onPress={() => setMaturity(item)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: active ? colours.accentSubtle : colours.surface,
                        borderColor: active ? colours.accent : colours.border,
                        borderRadius: radius.full,
                        paddingHorizontal: spacing[3],
                        paddingVertical: spacing[2],
                      },
                    ]}>
                    <AppText variant="caption" colour={active ? 'accent' : 'textSecondary'}>
                      {MATURITY_LABELS[item]}
                    </AppText>
                  </AppPressable>
                )
              })}
            </View>
          </View>

          <View style={{gap: spacing[3]}}>
            <AppText variant="headline">Domains</AppText>
            <View style={[styles.chipWrap, {gap: spacing[2]}]}>
              <DomainChip
                label="All domains"
                active={domain === 'all'}
                onPress={() => setDomain('all')}
              />
              {ATLAS_DOMAINS.map(item => (
                <DomainChip
                  key={item}
                  label={ATLAS_DOMAIN_LABELS[item]}
                  active={domain === item}
                  onPress={() => setDomain(item)}
                />
              ))}
            </View>
          </View>

          <View style={{gap: spacing[3]}}>
            <View style={[styles.titleRow, {gap: spacing[2]}]}>
              <AppText variant="headline" style={{flex: 1}}>
                {filtered.length} matches
              </AppText>
              <AppText variant="caption" colour="textSecondary">
                Tap a row to open its mapped surface.
              </AppText>
            </View>
            <View style={{gap: spacing[3]}}>
              {filtered.map(feature => (
                <FeatureRow key={feature.id} feature={feature} onPress={() => router.push(feature.route as Href)} />
              ))}
            </View>
          </View>
        </ScrollView>
      </ResponsiveContent>
    </View>
  )
}

function DomainChip({label, active, onPress}: {label: string; active: boolean; onPress: () => void}) {
  const {colours, radius, spacing} = useThemeTokens()
  return (
    <AppPressable
      accessibilityLabel={`Filter domain ${label}`}
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: active ? colours.accentSubtle : colours.surface,
          borderColor: active ? colours.accent : colours.border,
          borderRadius: radius.full,
          paddingHorizontal: spacing[3],
          paddingVertical: spacing[2],
        },
      ]}>
      <AppText variant="caption" colour={active ? 'accent' : 'textSecondary'}>
        {label}
      </AppText>
    </AppPressable>
  )
}

function FeatureRow({feature, onPress}: {feature: AtlasFeature; onPress: () => void}) {
  const {colours, radius, spacing} = useThemeTokens()
  return (
    <AppPressable
      accessibilityLabel={`Open ${feature.name}`}
      onPress={onPress}
      style={[
        styles.featureRow,
        {
          backgroundColor: colours.surface,
          borderColor: colours.border,
          borderRadius: radius.large,
          padding: spacing[4],
          gap: spacing[3],
        },
      ]}>
      <AppIcon name={feature.icon ?? 'info'} colour={colours.accent} />
      <View style={{flex: 1, gap: spacing[1]}}>
        <View style={[styles.titleRow, {gap: spacing[2]}]}>
          <AppText variant="headline" style={{flex: 1}}>
            {feature.name}
          </AppText>
          <AppText variant="caption" colour="accent">
            {feature.maturity}
          </AppText>
        </View>
        <AppText variant="caption" colour="textSecondary">
          {ATLAS_DOMAIN_LABELS[feature.domain]} / {maturityCopy(feature.maturity)}
        </AppText>
        <AppText variant="body" colour="textSecondary">
          {feature.summary}
        </AppText>
        <AppText variant="caption" colour="textTertiary">
          {feature.tags.join(' · ')}
        </AppText>
      </View>
      <AppIcon name="chevronRight" colour={colours.textTertiary} size={18} />
    </AppPressable>
  )
}

const styles = StyleSheet.create({
  screen: {flex: 1},
  hero: {borderWidth: StyleSheet.hairlineWidth},
  input: {borderWidth: StyleSheet.hairlineWidth, minHeight: 48},
  chipWrap: {flexDirection: 'row', flexWrap: 'wrap'},
  chip: {borderWidth: StyleSheet.hairlineWidth},
  statsRow: {flexDirection: 'row', flexWrap: 'wrap'},
  statPill: {borderWidth: StyleSheet.hairlineWidth},
  titleRow: {alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap'},
  featureRow: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
  },
})
