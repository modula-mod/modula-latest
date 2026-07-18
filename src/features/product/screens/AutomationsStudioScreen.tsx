import {useState} from 'react'
import {ScrollView, StyleSheet, Switch, TextInput, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {AppButton} from '@/components/primitives/AppButton'
import {AppIcon} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import {useProductPreferences} from '@/features/product/hooks/useProductPreferences'
import {selectionHaptic} from '@/lib/haptics'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const FLOWS = [
  {
    id: '1',
    title: 'Comment keyword → DM',
    trigger: 'New comment contains “INFO”',
    actions: ['Send DM', 'Tag CRM · Interested'],
  },
  {
    id: '2',
    title: 'Profile enquiry → lead',
    trigger: 'Contact form submitted',
    actions: ['Create CRM lead', 'Create Task', 'Notify owner'],
  },
  {
    id: '3',
    title: 'Save → Vault Notes',
    trigger: 'Post saved',
    actions: ['Add to Vault Notes', 'Optional Gaia summary'],
  },
  {
    id: '4',
    title: 'Purchase → unlock tab',
    trigger: 'Marketplace purchase',
    actions: ['Unlock profile tab', 'Send receipt'],
  },
]

const TRIGGERS = [
  'New comment contains keyword',
  'Contact form submitted',
  'Post saved',
  'Marketplace purchase',
  'Focus Mode enabled',
]

const ACTIONS = [
  'Send DM',
  'Create CRM lead',
  'Create Task',
  'Notify owner',
  'Add to Vault Notes',
  'Gaia summary (scoped)',
]

export function AutomationsStudioScreen() {
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()
  const {preferences, update} = useProductPreferences()
  const enabled = new Set(preferences.automationEnabledIds)
  const [draftTitle, setDraftTitle] = useState('My flow')
  const [draftTrigger, setDraftTrigger] = useState(TRIGGERS[0])
  const [draftActions, setDraftActions] = useState<string[]>([ACTIONS[0]])
  const [customFlows, setCustomFlows] = useState<typeof FLOWS>([])

  const allFlows = [...FLOWS, ...customFlows]

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title="Automations" />
      <ResponsiveContent maxWidth={720}>
        <ScrollView contentContainerStyle={{gap: spacing[5], padding: spacing[4]}}>
          <View style={{gap: spacing[2]}}>
            <AppText variant="display">Workflows for Profile-OS.</AppText>
            <AppText variant="body" colour="textSecondary">
              Enable drafts locally. Runner stays off — no unattended actions execute.
            </AppText>
          </View>

          <Surface
            variant="contained"
            style={[
              styles.card,
              {
                gap: spacing[3],
                padding: spacing[4],
                borderRadius: radius.large,
                backgroundColor: colours.surface,
                borderColor: colours.border,
              },
            ]}>
            <AppText variant="headline">Create flow · Preview</AppText>
            <TextInput
              value={draftTitle}
              onChangeText={setDraftTitle}
              accessibilityLabel="Flow title"
              placeholder="Flow title"
              placeholderTextColor={colours.textTertiary}
              style={[
                styles.input,
                {
                  backgroundColor: colours.surfaceRaised,
                  borderColor: colours.border,
                  borderRadius: radius.medium,
                  color: colours.text,
                  paddingHorizontal: spacing[3],
                },
              ]}
            />
            <AppText variant="caption" colour="textTertiary">
              TRIGGER
            </AppText>
            <View style={[styles.chips, {gap: spacing[2]}]}>
              {TRIGGERS.map(trigger => {
                const on = draftTrigger === trigger
                return (
                  <AppPressable
                    key={trigger}
                    accessibilityLabel={trigger}
                    onPress={() => setDraftTrigger(trigger)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: on ? colours.accentSubtle : colours.surfaceRaised,
                        borderColor: on ? colours.accent : colours.border,
                        borderRadius: radius.round,
                        paddingHorizontal: spacing[3],
                        paddingVertical: spacing[2],
                      },
                    ]}>
                    <AppText variant="caption" colour={on ? 'accent' : 'textSecondary'}>
                      {trigger}
                    </AppText>
                  </AppPressable>
                )
              })}
            </View>
            <AppText variant="caption" colour="textTertiary">
              ACTIONS
            </AppText>
            <View style={[styles.chips, {gap: spacing[2]}]}>
              {ACTIONS.map(action => {
                const on = draftActions.includes(action)
                return (
                  <AppPressable
                    key={action}
                    accessibilityLabel={action}
                    onPress={() =>
                      setDraftActions(prev =>
                        on ? prev.filter(item => item !== action) : [...prev, action],
                      )
                    }
                    style={[
                      styles.chip,
                      {
                        backgroundColor: on ? colours.accentSubtle : colours.surfaceRaised,
                        borderColor: on ? colours.accent : colours.border,
                        borderRadius: radius.round,
                        paddingHorizontal: spacing[3],
                        paddingVertical: spacing[2],
                      },
                    ]}>
                    <AppText variant="caption" colour={on ? 'accent' : 'textSecondary'}>
                      {action}
                    </AppText>
                  </AppPressable>
                )
              })}
            </View>
            <AppButton
              onPress={() => {
                const id = `custom-${Date.now()}`
                void selectionHaptic()
                setCustomFlows(prev => [
                  ...prev,
                  {
                    id,
                    title: draftTitle.trim() || 'Untitled flow',
                    trigger: draftTrigger,
                    actions: draftActions.length ? draftActions : [ACTIONS[0]],
                  },
                ])
                void update({
                  automationEnabledIds: [...preferences.automationEnabledIds, id],
                })
              }}>
              Save draft flow (local)
            </AppButton>
          </Surface>

          {allFlows.map(flow => {
            const on = enabled.has(flow.id)
            return (
              <Surface
                key={flow.id}
                variant="contained"
                style={[
                  styles.card,
                  {
                    gap: spacing[3],
                    padding: spacing[4],
                    borderRadius: radius.large,
                    backgroundColor: colours.surface,
                    borderColor: on ? colours.accent : colours.border,
                  },
                ]}>
                <View style={[styles.titleRow, {gap: spacing[2]}]}>
                  <AppIcon name="automation" colour={colours.accent} />
                  <AppText variant="headline" style={{flex: 1}}>
                    {flow.title}
                  </AppText>
                  <Switch
                    accessibilityLabel={`Enable ${flow.title}`}
                    value={on}
                    onValueChange={value => {
                      const next = value
                        ? [...preferences.automationEnabledIds, flow.id]
                        : preferences.automationEnabledIds.filter(id => id !== flow.id)
                      void update({automationEnabledIds: Array.from(new Set(next))})
                    }}
                  />
                </View>
                <View style={[styles.nodeRow, {gap: spacing[2]}]}>
                  <Surface
                    variant="contained"
                    style={[
                      styles.node,
                      {
                        backgroundColor: colours.accentSubtle,
                        borderRadius: radius.medium,
                        padding: spacing[3],
                      },
                    ]}>
                    <AppText variant="caption" colour="accent">
                      TRIGGER
                    </AppText>
                    <AppText variant="body">{flow.trigger}</AppText>
                  </Surface>
                  <AppText variant="caption" colour="textTertiary">
                    →
                  </AppText>
                  <Surface
                    variant="contained"
                    style={[
                      styles.node,
                      {
                        backgroundColor: colours.surfaceRaised,
                        borderRadius: radius.medium,
                        padding: spacing[3],
                        flex: 1,
                      },
                    ]}>
                    <AppText variant="caption" colour="textTertiary">
                      ACTIONS
                    </AppText>
                    {flow.actions.map(action => (
                      <AppText key={action} variant="caption" colour="textSecondary">
                        · {action}
                      </AppText>
                    ))}
                  </Surface>
                </View>
                <AppText variant="caption" colour="textTertiary">
                  {on ? 'Draft enabled locally · runner inactive' : 'Draft disabled'}
                </AppText>
              </Surface>
            )
          })}

          <Surface
            variant="contained"
            style={[
              styles.card,
              {
                gap: spacing[2],
                padding: spacing[4],
                borderRadius: radius.large,
                backgroundColor: colours.surfaceRaised,
                borderColor: colours.border,
              },
            ]}>
            <AppText variant="headline">Dry-run simulation</AppText>
            <AppText variant="body" colour="textSecondary">
              Preview path: Trigger → Command Layer → AKI check → Governor policy → Ledger entry.
              Runner stays inactive — no DMs, CRM writes, or Marketplace unlocks execute.
            </AppText>
            <AppText variant="caption" colour="textTertiary">
              Enabled drafts: {preferences.automationEnabledIds.length || 'none'} · open Ledger for
              sample audit rows.
            </AppText>
          </Surface>

          <AppButton onPress={() => router.push('/product/ledger' as Href)}>
            Open Ledger Replay
          </AppButton>
          <AppButton variant="secondary" onPress={() => router.push('/product/commands' as Href)}>
            Command Layer
          </AppButton>
          <AppButton variant="ghost" onPress={() => router.push('/marketplace/module-automations' as Href)}>
            Automations module card
          </AppButton>
          <AppButton variant="ghost" onPress={() => router.push('/product/forge' as Href)}>
            Build nodes in Forge
          </AppButton>
        </ScrollView>
      </ResponsiveContent>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {flex: 1},
  card: {borderWidth: StyleSheet.hairlineWidth},
  titleRow: {alignItems: 'center', flexDirection: 'row'},
  nodeRow: {alignItems: 'stretch', flexDirection: 'row'},
  node: {flex: 1, gap: 4},
  input: {borderWidth: StyleSheet.hairlineWidth, minHeight: 44},
  chips: {flexDirection: 'row', flexWrap: 'wrap'},
  chip: {borderWidth: StyleSheet.hairlineWidth},
})
