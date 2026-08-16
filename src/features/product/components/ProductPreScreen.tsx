import {useState} from 'react'
import {ScrollView, StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'
import {useSafeAreaInsets} from 'react-native-safe-area-context'

import {AppText} from '@/components/primitives/AppText'
import type {ProductCapability, ProductMaturity} from '@/features/product/data/productCatalogue'
import {ModulaButton} from '@/platform/ui/buttons/modula-button'
import {ProductStatsRow} from '@/platform/ui/chrome/product-stats-row'
import {shareModulaText} from '@/platform/ui/share/share-modula-text'
import {ModulaPageTabView} from '@/platform/ui/tabs/modula-page-tab-view'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const MATURITY_LABEL: Record<ProductMaturity, string> = {
  live: 'Live',
  preview: 'Preview',
  planned: 'Planned',
  inactive: 'Inactive',
}

const MATURITY_DETAIL: Record<ProductMaturity, string> = {
  live: 'In this build',
  preview: 'Honest preview',
  planned: 'Named, not shipped',
  inactive: 'Not a runtime',
}

export function ProductPreScreen({capability}: {capability: ProductCapability}) {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const {colours, spacing} = useThemeTokens()
  const [page, setPage] = useState('overview')

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader
        title={capability.name}
        onShare={() =>
          void shareModulaText({
            title: capability.name,
            message: `${capability.name} — ${capability.summary}`,
          })
        }
      />
      <ResponsiveContent maxWidth={720}>
        <ScrollView
          contentContainerStyle={{
            gap: spacing[5],
            padding: spacing[4],
            paddingBottom: insets.bottom + spacing[8],
          }}>
          <View style={{gap: spacing[2]}}>
            <AppText variant="micro" colour="textTertiary">
              {capability.eyebrow.toUpperCase()}
            </AppText>
            <AppText variant="display">{capability.name}</AppText>
            <AppText variant="title2">{capability.summary}</AppText>
          </View>

          <ProductStatsRow
            items={[
              {
                label: 'Status',
                value: MATURITY_LABEL[capability.maturity],
                detail: MATURITY_DETAIL[capability.maturity],
              },
              {
                label: 'Layer',
                value: capability.eyebrow,
                detail: 'Capability',
              },
              {
                label: 'Includes',
                value: String(capability.bullets.length),
                detail: 'Named surfaces',
              },
            ]}
          />

          <ModulaPageTabView
            accessibilityLabel={`${capability.name} pages`}
            selectedId={page}
            onSelect={setPage}
            height={300}
            tabs={[
              {
                id: 'overview',
                title: 'Overview',
                icon: 'info',
                content: (
                  <View style={{gap: spacing[3]}}>
                    <AppText variant="body" colour="textSecondary">
                      {capability.body}
                    </AppText>
                    {capability.pipeline ? (
                      <View style={{gap: spacing[1]}}>
                        <AppText variant="label">Pipeline</AppText>
                        <AppText variant="body" colour="textSecondary">
                          {capability.pipeline}
                        </AppText>
                      </View>
                    ) : null}
                  </View>
                ),
              },
              {
                id: 'includes',
                title: 'Includes',
                icon: 'modules',
                content: (
                  <View style={{gap: spacing[3]}}>
                    {capability.bullets.map(bullet => (
                      <AppText key={bullet} variant="body">
                        {bullet}
                      </AppText>
                    ))}
                  </View>
                ),
              },
            ]}
          />

          {capability.maturity === 'inactive' || capability.maturity === 'planned' ? (
            <AppText variant="caption" colour="textTertiary">
              Honest preview — this surface explains direction. It does not fake live data, balances,
              or untrusted code execution.
            </AppText>
          ) : null}

          <View style={{gap: spacing[3]}}>
            {capability.ctaLabel && capability.ctaRoute ? (
              <ModulaButton
                label={capability.ctaLabel}
                onPress={() => router.push(capability.ctaRoute as Href)}
              />
            ) : null}
            {capability.secondaryLabel && capability.secondaryRoute ? (
              <ModulaButton
                label={capability.secondaryLabel}
                role="secondary"
                onPress={() => router.push(capability.secondaryRoute as Href)}
              />
            ) : null}
            <ModulaButton
              label="All Modula capabilities"
              role="secondary"
              onPress={() => router.push('/product' as Href)}
            />
          </View>
        </ScrollView>
      </ResponsiveContent>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {flex: 1},
})
