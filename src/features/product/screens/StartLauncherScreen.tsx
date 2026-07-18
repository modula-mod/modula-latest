import {useMemo, useState} from 'react'
import {ScrollView, StyleSheet, TextInput, View} from 'react-native'
import {useLocalSearchParams, useRouter, type Href} from 'expo-router'

import {AppIcon, type AppIconName} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {CommandPreviewCard} from '@/features/product/components/CommandPreviewCard'
import {COMMAND_CATALOGUE, type ModulaCommand} from '@/features/product/data/commandCatalogue'
import {
  getLauncherSearchGroups,
  type LauncherSearchHit,
} from '@/features/product/data/launcherSearch'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const QUICK_ACTIONS: Array<{
  id: string
  label: string
  detail: string
  icon: AppIconName
  route: string
}> = [
  {
    id: 'design-lab',
    label: 'Design Lab',
    detail: 'Themes and layouts',
    icon: 'appearance',
    route: '/product/themes',
  },
  {
    id: 'nft',
    label: 'NFT',
    detail: 'Inactive ownership preview',
    icon: 'security',
    route: '/product/nft',
  },
  {
    id: 'atlas',
    label: 'Atlas',
    detail: 'Feature map',
    icon: 'search',
    route: '/product/atlas',
  },
  {
    id: 'developer',
    label: 'Developer',
    detail: 'Tools and CLI references',
    icon: 'tools',
    route: '/product/developer',
  },
  {
    id: 'focus-deep',
    label: 'Focus Deep',
    detail: 'Open Focus presets',
    icon: 'contrast',
    route: '/product/focus',
  },
  {
    id: 'create-task',
    label: 'Create task',
    detail: 'Preview command',
    icon: 'check',
    route: '/product/start?command=tasks.create',
  },
  {id: 'board', label: 'Open Board', detail: 'Daily control centre', icon: 'board', route: '/board'},
  {id: 'gaia', label: 'GAIA', detail: 'Governed console', icon: 'automation', route: '/product/gaia'},
  {
    id: 'commands',
    label: 'Commands',
    detail: 'Typed action router',
    icon: 'developer',
    route: '/product/commands',
  },
  {id: 'forge', label: 'Forge', detail: 'Builder Preview', icon: 'developer', route: '/product/forge'},
]

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? ''
}

export function StartLauncherScreen() {
  const params = useLocalSearchParams<{command?: string; query?: string}>()
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()
  const commandParam = firstParam(params.command)
  const queryParam = firstParam(params.query)
  const [query, setQuery] = useState(queryParam)
  const [selectedCommand, setSelectedCommand] = useState<ModulaCommand | null>(
    () => COMMAND_CATALOGUE.find(command => command.id === commandParam) ?? null,
  )

  const groups = useMemo(
    () => getLauncherSearchGroups(query, {defaultLimit: 4, searchLimit: 10}),
    [query],
  )
  const visibleGroups = groups.filter(group => group.hits.length > 0)

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title="Start" />
      <ResponsiveContent maxWidth={720}>
        <ScrollView contentContainerStyle={{gap: spacing[5], padding: spacing[4]}}>
          <View style={{gap: spacing[2]}}>
            <AppText variant="caption" colour="accent">
              LAUNCHER / PREVIEW COMMANDS / LOCAL SEARCH
            </AppText>
            <AppText variant="display">Start from intent.</AppText>
            <AppText variant="body" colour="textSecondary">
              Quick actions and search resolve to product surfaces, modules, or typed commands. Selecting
              a command opens a confirmation preview only; no side effects run from this launcher.
            </AppText>
          </View>

          <View style={[styles.grid, {gap: spacing[3]}]}>
            {QUICK_ACTIONS.map(action => (
              <AppPressable
                key={action.id}
                accessibilityLabel={action.label}
                onPress={() => router.push(action.route as Href)}
                style={[
                  styles.quickCard,
                  {
                    backgroundColor: colours.surface,
                    borderColor: colours.border,
                    borderRadius: radius.large,
                    padding: spacing[4],
                    gap: spacing[2],
                  },
                ]}>
                <AppIcon name={action.icon} colour={colours.accent} />
                <AppText variant="headline">{action.label}</AppText>
                <AppText variant="caption" colour="textSecondary">
                  {action.detail}
                </AppText>
              </AppPressable>
            ))}
          </View>

          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search commands, capabilities, modules..."
            placeholderTextColor={colours.textTertiary}
            accessibilityLabel="Search Start launcher"
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
            <View style={[styles.titleRow, {gap: spacing[2]}]}>
              <AppText variant="headline" style={{flex: 1}}>
                Results
              </AppText>
              <AppPressable onPress={() => router.push('/product/search' as Href)}>
                <AppText variant="caption" colour="accent">
                  Universal Search -&gt;
                </AppText>
              </AppPressable>
            </View>
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
                No local Start results for "{query.trim()}".
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
  grid: {flexDirection: 'row', flexWrap: 'wrap'},
  quickCard: {
    borderWidth: StyleSheet.hairlineWidth,
    flexBasis: '47%',
    flexGrow: 1,
    minHeight: 130,
    minWidth: 150,
  },
  input: {borderWidth: StyleSheet.hairlineWidth, minHeight: 48},
  titleRow: {alignItems: 'center', flexDirection: 'row'},
  hit: {
    alignItems: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
  },
  hitText: {flex: 1, gap: 4},
})
