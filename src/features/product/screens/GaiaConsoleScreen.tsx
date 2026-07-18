import {useState} from 'react'
import {ScrollView, StyleSheet, Switch, TextInput, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {AppButton} from '@/components/primitives/AppButton'
import {AppIcon, type AppIconName} from '@/components/primitives/AppIcon'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import {useProductPreferences} from '@/features/product/hooks/useProductPreferences'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const AGENTS: Array<{name: string; icon: AppIconName; scope: string}> = [
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

export function GaiaConsoleScreen() {
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()
  const {preferences, update} = useProductPreferences()
  const [prompt, setPrompt] = useState('')
  const [reply, setReply] = useState<string | null>(null)
  const allowed = new Set(preferences.gaiaAllowedScopes)

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title="Gaia" />
      <ResponsiveContent maxWidth={720}>
        <ScrollView contentContainerStyle={{gap: spacing[5], padding: spacing[4]}}>
          <View style={{gap: spacing[2]}}>
            <AppText variant="display">Intelligence with permission.</AppText>
            <AppText variant="body" colour="textSecondary">
              Scopes persist locally. Responses are deterministic Preview labels — no model calls.
            </AppText>
          </View>

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
                    styles.card,
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
            <AppText variant="headline">Ask Gaia (Preview)</AppText>
            <TextInput
              value={prompt}
              onChangeText={setPrompt}
              placeholder="e.g. Summarise my Board focus"
              placeholderTextColor={colours.textTertiary}
              accessibilityLabel="Gaia prompt"
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
                  `Preview (not a model): Based on allowed scopes [${preferences.gaiaAllowedScopes.join(', ')}], Gaia would only use those surfaces for “${text}”. No private modules were read.`,
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

          <AppButton onPress={() => router.push('/product/gaia-atlas' as Href)}>
            Open Gaia Atlas
          </AppButton>
        </ScrollView>
      </ResponsiveContent>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {flex: 1},
  scopeRow: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
  },
  grid: {flexDirection: 'row', flexWrap: 'wrap'},
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    flexBasis: '47%',
    flexGrow: 1,
    minWidth: 150,
  },
  input: {borderWidth: StyleSheet.hairlineWidth, minHeight: 48},
  reply: {borderWidth: StyleSheet.hairlineWidth},
})
