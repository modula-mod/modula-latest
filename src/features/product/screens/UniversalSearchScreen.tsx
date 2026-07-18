import {useMemo, useState} from 'react'
import {ScrollView, StyleSheet, TextInput, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {AppIcon, type AppIconName} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import {COMMAND_CATALOGUE} from '@/features/product/data/commandCatalogue'
import {productCatalogue} from '@/features/product/data/productCatalogue'
import {marketplaceCatalog} from '@/features/marketplace/data/catalog'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type Hit = {id: string; title: string; subtitle: string; icon: AppIconName; route: string}

export function UniversalSearchScreen() {
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()
  const [query, setQuery] = useState('')

  const hits = useMemo(() => {
    const q = query.trim().toLowerCase()
    const capabilityHits: Hit[] = productCatalogue.map(item => ({
      id: `cap-${item.id}`,
      title: item.name,
      subtitle: `Capability · ${item.maturity}`,
      icon: item.icon,
      route: `/product/${item.id}`,
    }))
    const moduleHits: Hit[] = marketplaceCatalog.map(item => ({
      id: `mod-${item.id}`,
      title: item.name,
      subtitle: `Module · ${item.status}`,
      icon: item.icon,
      route: `/marketplace/${item.id}`,
    }))
    const commandHits: Hit[] = COMMAND_CATALOGUE.map(command => ({
      id: `cmd-${command.id}`,
      title: command.label,
      subtitle: `Command · ${command.risk} · Preview executable`,
      icon: 'developer',
      route: `/product/start?command=${encodeURIComponent(command.id)}`,
    }))
    const all = [...commandHits, ...capabilityHits, ...moduleHits]
    if (!q) return all.slice(0, 12)
    return all.filter(hit => `${hit.title} ${hit.subtitle}`.toLowerCase().includes(q)).slice(0, 24)
  }, [query])

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title="Search" />
      <ResponsiveContent maxWidth={720}>
        <ScrollView contentContainerStyle={{gap: spacing[4], padding: spacing[4]}}>
          <View style={{gap: spacing[2]}}>
            <AppText variant="display">Search across Modula.</AppText>
            <AppText variant="body" colour="textSecondary">
              People, posts, modules, notes, CRM — permission-aware. This Preview searches
              capabilities and marketplace cards locally.
            </AppText>
          </View>

          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search modules, capabilities…"
            placeholderTextColor={colours.textTertiary}
            accessibilityLabel="Search Modula"
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

          <View style={{gap: spacing[2]}}>
            {hits.map(hit => (
              <AppPressable
                key={hit.id}
                accessibilityLabel={hit.title}
                onPress={() => router.push(hit.route as Href)}
                style={[
                  styles.hit,
                  {
                    backgroundColor: colours.surface,
                    borderColor: colours.border,
                    borderRadius: radius.medium,
                    padding: spacing[3],
                    gap: spacing[3],
                  },
                ]}>
                <AppIcon name={hit.icon} colour={colours.accent} />
                <View style={{flex: 1, gap: 2}}>
                  <AppText variant="headline">{hit.title}</AppText>
                  <AppText variant="caption" colour="textSecondary">
                    {hit.subtitle}
                  </AppText>
                </View>
                <AppIcon name="chevronRight" colour={colours.textTertiary} size={18} />
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
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 48,
  },
  hit: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
  },
})
