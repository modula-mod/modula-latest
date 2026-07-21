import {useMemo, useState} from 'react'
import {ScrollView, StyleSheet, TextInput, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {AppIcon} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {CommandPreviewCard} from '@/features/product/components/CommandPreviewCard'
import type {ModulaCommand} from '@/features/product/data/commandCatalogue'
import {
  getLauncherSearchGroups,
  type LauncherSearchHit,
} from '@/features/product/data/launcherSearch'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function UniversalSearchScreen() {
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()
  const [query, setQuery] = useState('')
  const [selectedCommand, setSelectedCommand] = useState<ModulaCommand | null>(null)

  const groups = useMemo(
    () => getLauncherSearchGroups(query, {defaultLimit: 4, searchLimit: 12}),
    [query],
  )
  const visibleGroups = groups.filter(group => group.hits.length > 0)

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

          {selectedCommand ? (
            <CommandPreviewCard
              command={selectedCommand}
              onDismiss={() => setSelectedCommand(null)}
            />
          ) : null}

          <View style={{gap: spacing[2]}}>
            {visibleGroups.length ? (
              visibleGroups.map(group => (
                <View key={group.id} style={{gap: spacing[2]}}>
                  <AppText variant="caption" colour="accent">
                    {group.title}
                  </AppText>
                  {group.hits.map(hit => (
                    <SearchHitRow
                      key={hit.id}
                      hit={hit}
                      onPress={() => {
                        if (hit.command) {
                          setSelectedCommand(hit.command)
                          return
                        }
                        if (hit.route) router.push(hit.route as Href)
                      }}
                    />
                  ))}
                </View>
              ))
            ) : (
              <AppText variant="body" colour="textSecondary">
                {'No local search results for "'}
                {query.trim()}
                {'".'}
              </AppText>
            )}
          </View>
        </ScrollView>
      </ResponsiveContent>
    </View>
  )
}

function SearchHitRow({hit, onPress}: {hit: LauncherSearchHit; onPress: () => void}) {
  const {colours, radius, spacing} = useThemeTokens()

  return (
    <AppPressable
      accessibilityLabel={hit.title}
      onPress={onPress}
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
      <View style={styles.hitText}>
        <AppText variant="headline">{hit.title}</AppText>
        <AppText variant="caption" colour="textSecondary">
          {hit.subtitle}
        </AppText>
        <AppText variant="caption" colour="textTertiary">
          {hit.body}
        </AppText>
      </View>
      <AppIcon
        name={hit.command ? 'info' : 'chevronRight'}
        colour={colours.textTertiary}
        size={18}
      />
    </AppPressable>
  )
}

const styles = StyleSheet.create({
  screen: {flex: 1},
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 48,
  },
  hit: {
    alignItems: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
  },
  hitText: {flex: 1, gap: 4},
})
