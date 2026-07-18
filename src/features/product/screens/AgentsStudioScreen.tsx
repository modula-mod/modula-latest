import {useState} from 'react'
import {ScrollView, StyleSheet, Switch, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {AppButton} from '@/components/primitives/AppButton'
import {AppIcon, type AppIconName} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import {useProductPreferences} from '@/features/product/hooks/useProductPreferences'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const AGENTS: Array<{
  id: string
  name: string
  role: string
  icon: AppIconName
  scopes: string[]
}> = [
  {
    id: 'summariser',
    name: 'Summariser',
    role: 'Compress threads and notes you allow',
    icon: 'text',
    scopes: ['composer', 'notes'],
  },
  {
    id: 'scheduler',
    name: 'Scheduler',
    role: 'Propose times from Calendar access',
    icon: 'event',
    scopes: ['calendar'],
  },
  {
    id: 'crm',
    name: 'CRM Analyst',
    role: 'Surface lead next-steps from CRM',
    icon: 'people',
    scopes: ['crm'],
  },
  {
    id: 'content',
    name: 'Content Assistant',
    role: 'Draft posts in Composer only',
    icon: 'create',
    scopes: ['composer'],
  },
  {
    id: 'automation',
    name: 'Automation Agent',
    role: 'Suggest flow nodes — never runs alone',
    icon: 'automation',
    scopes: ['automations'],
  },
  {
    id: 'research',
    name: 'Research Agent',
    role: 'Search allowed public + module sources',
    icon: 'search',
    scopes: ['search'],
  },
]

export function AgentsStudioScreen() {
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()
  const {preferences, update} = useProductPreferences()
  const [activeId, setActiveId] = useState(AGENTS[0].id)
  const [enabled, setEnabled] = useState<string[]>(['summariser', 'content'])
  const active = AGENTS.find(agent => agent.id === activeId) ?? AGENTS[0]
  const allowed = new Set(preferences.gaiaAllowedScopes)

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title="Agents" />
      <ResponsiveContent maxWidth={720}>
        <ScrollView contentContainerStyle={{gap: spacing[5], padding: spacing[4]}}>
          <View style={{gap: spacing[2]}}>
            <AppText variant="display">Agents module — Preview.</AppText>
            <AppText variant="body" colour="textSecondary">
              Installable agent packages will extend Gaia. This studio is local Preview — not a
              model runtime. Agents never silently read private modules.
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
              SELECTED AGENT
            </AppText>
            <AppText variant="title">{active.name}</AppText>
            <AppText variant="body" colour="textSecondary">
              {active.role}
            </AppText>
            <AppText variant="caption" colour="textSecondary">
              Needs scopes: {active.scopes.join(', ')}
            </AppText>
            <AppText variant="caption" colour="textTertiary">
              Allowed now: {[...allowed].join(', ') || 'none'}
            </AppText>
          </Surface>

          <View style={{gap: spacing[3]}}>
            {AGENTS.map(agent => {
              const on = enabled.includes(agent.id)
              const selected = agent.id === activeId
              return (
                <AppPressable
                  key={agent.id}
                  accessibilityLabel={agent.name}
                  onPress={() => setActiveId(agent.id)}
                  style={[
                    styles.row,
                    {
                      padding: spacing[4],
                      gap: spacing[3],
                      borderRadius: radius.medium,
                      backgroundColor: selected ? colours.accentSubtle : colours.surface,
                      borderColor: selected ? colours.accent : colours.border,
                    },
                  ]}>
                  <AppIcon name={agent.icon} colour={colours.accent} />
                  <View style={{flex: 1, gap: 2}}>
                    <AppText variant="headline">{agent.name}</AppText>
                    <AppText variant="caption" colour="textSecondary">
                      {agent.role}
                    </AppText>
                  </View>
                  <Switch
                    accessibilityLabel={`Enable ${agent.name} preview`}
                    value={on}
                    onValueChange={value => {
                      setEnabled(prev =>
                        value ? [...prev, agent.id] : prev.filter(id => id !== agent.id),
                      )
                      if (value) {
                        const nextScopes = [...new Set([...preferences.gaiaAllowedScopes, ...agent.scopes])]
                        void update({gaiaAllowedScopes: nextScopes})
                      }
                    }}
                  />
                </AppPressable>
              )
            })}
          </View>

          <AppButton onPress={() => router.push('/product/gaia' as Href)}>Open Gaia console</AppButton>
          <AppButton variant="secondary" onPress={() => router.push('/marketplace/module-agents' as Href)}>
            Agents marketplace card
          </AppButton>
          <AppButton variant="ghost" onPress={() => router.push('/product/forge' as Href)}>
            Build an agent surface in Forge
          </AppButton>
        </ScrollView>
      </ResponsiveContent>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {flex: 1},
  card: {borderWidth: StyleSheet.hairlineWidth},
  row: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
  },
})
