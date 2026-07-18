import {useMemo, useState} from 'react'
import {ScrollView, StyleSheet, TextInput, View} from 'react-native'
import {useLocalSearchParams, useRouter, type Href} from 'expo-router'

import {AppButton} from '@/components/primitives/AppButton'
import {AppIcon, type AppIconName} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import {marketplaceCatalog} from '@/features/marketplace/data/catalog'
import {
  COMMAND_CATALOGUE,
  type CommandRisk,
  type ModulaCommand,
} from '@/features/product/data/commandCatalogue'
import {ATLAS_DOMAIN_LABELS, atlasSearch} from '@/features/product/data/featureAtlas'
import {productCatalogue} from '@/features/product/data/productCatalogue'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type Hit = {
  id: string
  title: string
  subtitle: string
  body: string
  icon: AppIconName
  route?: string
  command?: ModulaCommand
}

const QUICK_ACTIONS: Array<{
  id: string
  label: string
  detail: string
  icon: AppIconName
  route: string
}> = [
  {
    id: 'deep-focus',
    label: 'Deep Focus',
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
  {
    id: 'intelligence',
    label: 'Intelligence Hub',
    detail: 'GAIA / AKI / Governor',
    icon: 'discover',
    route: '/product/intelligence',
  },
  {id: 'gaia', label: 'GAIA', detail: 'Governed console', icon: 'automation', route: '/product/gaia'},
  {
    id: 'commands',
    label: 'Commands',
    detail: 'Typed action router',
    icon: 'developer',
    route: '/product/commands',
  },
  {id: 'forge', label: 'Forge', detail: 'Builder Preview', icon: 'developer', route: '/product/forge'},
  {
    id: 'dimon',
    label: 'DIMON status',
    detail: 'Inactive status only',
    icon: 'security',
    route: '/settings/dimon',
  },
]

const RISK_COPY: Record<CommandRisk, string> = {
  low: 'Low risk: safe to preview and easy to undo in the final product path.',
  medium: 'Medium risk: needs a visible preview and explicit scope check before any write.',
  high: 'High risk: requires explicit confirmation and may be blocked while dependencies are inactive.',
}

const CONFIRM_COPY: Record<ModulaCommand['confirmation'], string> = {
  none: 'No confirmation required for the eventual action, but this launcher still does not execute it.',
  preview: 'Preview required: user reviews the plan before the eventual command can run.',
  explicit: 'Explicit confirmation required: the user must approve before any consequential action.',
}

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

  const hits = useMemo(() => {
    const q = query.trim().toLowerCase()
    const commandHits: Hit[] = COMMAND_CATALOGUE.map(command => ({
      id: `command-${command.id}`,
      title: command.label,
      subtitle: `Command / ${command.risk} / confirm ${command.confirmation}`,
      body: command.description,
      icon: 'developer',
      command,
    }))
    const productHits: Hit[] = productCatalogue.map(item => ({
      id: `product-${item.id}`,
      title: item.name,
      subtitle: `Capability / ${item.maturity}`,
      body: item.summary,
      icon: item.icon,
      route: item.ctaRoute ?? `/product/${item.id}`,
    }))
    const marketplaceHits: Hit[] = marketplaceCatalog.map(item => ({
      id: `market-${item.id}`,
      title: item.name,
      subtitle: `Marketplace / ${item.status}`,
      body: item.description,
      icon: item.icon,
      route: `/marketplace/${item.id}`,
    }))
    const atlasHits: Hit[] = atlasSearch(q)
      .slice(0, q ? 12 : 6)
      .map(feature => ({
        id: `atlas-${feature.id}`,
        title: feature.name,
        subtitle: `Atlas / ${ATLAS_DOMAIN_LABELS[feature.domain]} / ${feature.maturity}`,
        body: `${feature.summary} ${feature.tags.join(' ')}`,
        icon: feature.icon ?? 'info',
        route: feature.route,
      }))
    const all = [...commandHits, ...productHits, ...atlasHits, ...marketplaceHits]
    if (!q) return all.slice(0, 16)
    return all
      .filter(hit => `${hit.title} ${hit.subtitle} ${hit.body}`.toLowerCase().includes(q))
      .slice(0, 28)
  }, [query])

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
            <Surface
              variant="contained"
              style={[
                styles.card,
                {
                  backgroundColor: colours.accentSubtle,
                  borderColor: colours.accent,
                  borderRadius: radius.large,
                  padding: spacing[4],
                  gap: spacing[2],
                },
              ]}>
              <AppText variant="caption" colour="accent">
                COMMAND PREVIEW / DOES NOT EXECUTE
              </AppText>
              <AppText variant="headline">{selectedCommand.label}</AppText>
              <AppText variant="body" colour="textSecondary">
                {selectedCommand.description}
              </AppText>
              <AppText variant="caption" colour="textSecondary">
                Risk / {RISK_COPY[selectedCommand.risk]}
              </AppText>
              <AppText variant="caption" colour="textSecondary">
                Confirmation / {CONFIRM_COPY[selectedCommand.confirmation]}
              </AppText>
              <AppText variant="caption" colour="textTertiary">
                Undo policy / {selectedCommand.undo}
              </AppText>
              {selectedCommand.permissions.length ? (
                <AppText variant="caption" colour="textTertiary">
                  Permissions requested / {selectedCommand.permissions.join(', ')}
                </AppText>
              ) : null}
              {selectedCommand.id.startsWith('dimon.') ? (
                <AppText variant="caption" colour="textTertiary">
                  DIMON is not active yet
                </AppText>
              ) : null}
              <View style={[styles.actions, {gap: spacing[2]}]}>
                <AppButton
                  variant="secondary"
                  onPress={() => router.push('/product/commands' as Href)}
                  style={styles.actionButton}>
                  Open Command Layer
                </AppButton>
                <AppButton
                  variant="ghost"
                  onPress={() => setSelectedCommand(null)}
                  style={styles.actionButton}>
                  Dismiss Preview
                </AppButton>
              </View>
            </Surface>
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
            {hits.map(hit => (
              <AppPressable
                key={hit.id}
                accessibilityLabel={hit.title}
                onPress={() => {
                  if (hit.command) {
                    setSelectedCommand(hit.command)
                    return
                  }
                  if (hit.route) router.push(hit.route as Href)
                }}
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
                <AppIcon name={hit.command ? 'info' : 'chevronRight'} colour={colours.textTertiary} size={18} />
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
  grid: {flexDirection: 'row', flexWrap: 'wrap'},
  quickCard: {
    borderWidth: StyleSheet.hairlineWidth,
    flexBasis: '47%',
    flexGrow: 1,
    minHeight: 130,
    minWidth: 150,
  },
  input: {borderWidth: StyleSheet.hairlineWidth, minHeight: 48},
  card: {borderWidth: StyleSheet.hairlineWidth},
  titleRow: {alignItems: 'center', flexDirection: 'row'},
  hit: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
  },
  actions: {flexDirection: 'row', flexWrap: 'wrap'},
  actionButton: {flexGrow: 1},
})
