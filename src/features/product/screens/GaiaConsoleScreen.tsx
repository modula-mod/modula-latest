import {useState} from 'react'
import {ScrollView, StyleSheet, Switch, TextInput, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {AppButton} from '@/components/primitives/AppButton'
import {AppIcon, type AppIconName} from '@/components/primitives/AppIcon'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import {evaluateFocusPolicy} from '@/features/product/data/focusPolicy'
import {useProductPreferences} from '@/features/product/hooks/useProductPreferences'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useFloatingTabBarContentPadding} from '@/platform/ui/navigation/floating-tab-bar-inset'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const AGENTS: {name: string; icon: AppIconName; scope: string}[] = [
  {name: 'Summariser', icon: 'text', scope: 'feed'},
  {name: 'Scheduler', icon: 'event', scope: 'calendar'},
  {name: 'CRM Analyst', icon: 'people', scope: 'crm'},
  {name: 'Content Assistant', icon: 'create', scope: 'composer'},
  {name: 'Automation Agent', icon: 'automation', scope: 'automations'},
  {name: 'Research Agent', icon: 'search', scope: 'search'},
]

const SCOPES = [
  {id: 'composer', label: 'Composer drafts'},
  {id: 'tasks', label: 'Tasks module'},
  {id: 'crm', label: 'CRM module'},
  {id: 'feed', label: 'Home feed summaries'},
  {id: 'calendar', label: 'Calendar'},
  {id: 'automations', label: 'Automations'},
  {id: 'search', label: 'Search queries'},
]

const FLOW = [
  'GAIA interprets + prepares a plan',
  'Command Layer resolves tools',
  'AKI verifies claims + permissions',
  'Governor applies autonomy / approval',
  'User confirms consequential actions',
  'Ledger records the path',
]

export function GaiaConsoleScreen() {
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()
  const tabPadding = useFloatingTabBarContentPadding()
  const {preferences, update} = useProductPreferences()
  const [prompt, setPrompt] = useState('')
  const [reply, setReply] = useState<string | null>(null)
  const allowed = new Set(preferences.gaiaAllowedScopes)
  const focusPreset = preferences.focus.preset ?? 'off'
  const focusPolicy = evaluateFocusPolicy(focusPreset)
  const gaiaMayInterrupt = focusPolicy.gaiaUnsolicitedAllowed

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title="GAIA" />
      <ResponsiveContent maxWidth={720}>
        <ScrollView contentContainerStyle={{gap: spacing[5], padding: spacing[4], paddingBottom: tabPadding}}>
          <View style={{gap: spacing[2]}}>
            <AppText variant="caption" colour="accent">
              EXECUTES · AKI VERIFIES · GOVERNOR CONTROLS
            </AppText>
            <AppText variant="display">The intelligence users work with.</AppText>
            <AppText variant="body" colour="textSecondary">
              GAIA is context and orchestration — not an unrestricted agent. It operates through the
              Command Layer, module permissions, AKI validation, and Governor policy. This console is
              Preview: deterministic labels only, no model calls.
            </AppText>
          </View>

          <Surface
            variant="contained"
            style={[
              styles.card,
              {
                padding: spacing[4],
                gap: spacing[2],
                borderRadius: radius.large,
                backgroundColor: colours.surface,
                borderColor: colours.border,
              },
            ]}>
            <AppText variant="caption" colour="textTertiary">
              GOVERNED FLOW
            </AppText>
            {FLOW.map((step, index) => (
              <AppText key={step} variant="body" colour="textSecondary">
                {index + 1}. {step}
              </AppText>
            ))}
          </Surface>

          <Surface
            variant="contained"
            style={[
              styles.card,
              {
                padding: spacing[4],
                gap: spacing[2],
                borderRadius: radius.large,
                backgroundColor: colours.surface,
                borderColor: colours.border,
              },
            ]}>
            <AppText variant="headline">GaiaFocusAdapter</AppText>
            <AppText variant="body" colour="textSecondary">
              Focus preset · {focusPreset}
            </AppText>
            <AppText variant="caption" colour={gaiaMayInterrupt ? 'accent' : 'textTertiary'}>
              {gaiaMayInterrupt
                ? 'Unsolicited GAIA suggestions allowed under this preset.'
                : 'Deep / Custom Focus: GAIA avoids unsolicited interruptions.'}
            </AppText>
          </Surface>

          <View style={{gap: spacing[3]}}>
            <AppText variant="headline">Allowed scopes</AppText>
            {SCOPES.map(scope => (
              <Surface
                key={scope.id}
                variant="contained"
                style={[
                  styles.scopeRow,
                  {
                    padding: spacing[3],
                    borderRadius: radius.medium,
                    backgroundColor: colours.surface,
                    borderColor: colours.border,
                    gap: spacing[3],
                  },
                ]}>
                <AppText variant="body" style={{flex: 1}}>
                  {scope.label}
                </AppText>
                <Switch
                  accessibilityLabel={scope.label}
                  value={allowed.has(scope.id)}
                  onValueChange={value => {
                    const next = value
                      ? [...preferences.gaiaAllowedScopes, scope.id]
                      : preferences.gaiaAllowedScopes.filter(id => id !== scope.id)
                    void update({gaiaAllowedScopes: Array.from(new Set(next))})
                  }}
                />
              </Surface>
            ))}
          </View>

          <View style={[styles.grid, {gap: spacing[3]}]}>
            {AGENTS.map(agent => {
              const permitted = allowed.has(agent.scope)
              return (
                <Surface
                  key={agent.name}
                  variant="contained"
                  style={[
                    styles.agentCard,
                    {
                      padding: spacing[4],
                      gap: spacing[2],
                      borderRadius: radius.large,
                      backgroundColor: colours.surface,
                      borderColor: permitted ? colours.accent : colours.border,
                    },
                  ]}>
                  <AppIcon name={agent.icon} colour={colours.accent} />
                  <AppText variant="headline">{agent.name}</AppText>
                  <AppText variant="caption" colour="textSecondary">
                    Scope · {agent.scope}
                  </AppText>
                  <AppText variant="caption" colour={permitted ? 'accent' : 'textTertiary'}>
                    {permitted ? 'Scope allowed' : 'Blocked by permissions'}
                  </AppText>
                </Surface>
              )
            })}
          </View>

          <View style={{gap: spacing[2]}}>
            <AppText variant="headline">Ask GAIA (Preview)</AppText>
            <TextInput
              value={prompt}
              onChangeText={setPrompt}
              placeholder="e.g. Prepare my Board for tomorrow"
              placeholderTextColor={colours.textTertiary}
              accessibilityLabel="GAIA prompt"
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
            <AppButton
              onPress={() => {
                const text = prompt.trim()
                if (!text) {
                  setReply('Enter a prompt to see a Preview response.')
                  return
                }
                if (preferences.gaiaAllowedScopes.length === 0) {
                  setReply('Preview: blocked — grant at least one scope first.')
                  return
                }
                setReply(
                  `Preview (not a model): GAIA would plan “${text}” using scopes [${preferences.gaiaAllowedScopes.join(', ')}], route via Command Layer, request AKI verification, and await Governor + user confirmation before any write. No private modules were read.`,
                )
              }}>
              Run Preview
            </AppButton>
            {reply ? (
              <Surface
                variant="contained"
                style={[
                  styles.reply,
                  {
                    padding: spacing[4],
                    borderRadius: radius.medium,
                    backgroundColor: colours.surfaceRaised,
                    borderColor: colours.border,
                  },
                ]}>
                <AppText variant="body" colour="textSecondary">
                  {reply}
                </AppText>
              </Surface>
            ) : null}
          </View>

          <AppButton onPress={() => router.push('/product/intelligence' as Href)}>
            Intelligence Hub
          </AppButton>
          <AppButton variant="secondary" onPress={() => router.push('/product/aki' as Href)}>
            Open AKI
          </AppButton>
          <AppButton variant="secondary" onPress={() => router.push('/product/governor' as Href)}>
            Open AGI Governor
          </AppButton>
          <AppButton variant="ghost" onPress={() => router.push('/product/commands' as Href)}>
            Command Layer
          </AppButton>
          <AppButton variant="ghost" onPress={() => router.push('/product/gaia-atlas' as Href)}>
            Gaia Atlas
          </AppButton>
        </ScrollView>
      </ResponsiveContent>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {flex: 1},
  card: {borderWidth: StyleSheet.hairlineWidth},
  scopeRow: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
  },
  grid: {flexDirection: 'row', flexWrap: 'wrap'},
  agentCard: {
    borderWidth: StyleSheet.hairlineWidth,
    flexBasis: '47%',
    flexGrow: 1,
    minWidth: 150,
  },
  input: {borderWidth: StyleSheet.hairlineWidth, minHeight: 48},
  reply: {borderWidth: StyleSheet.hairlineWidth},
})
