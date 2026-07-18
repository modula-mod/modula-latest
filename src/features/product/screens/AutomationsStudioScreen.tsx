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
import {useFloatingTabBarContentPadding} from '@/platform/ui/navigation/floating-tab-bar-inset'
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

const RELATED_LINKS: Array<{label: string; href: Href; variant?: 'secondary' | 'ghost'}> = [
  {label: 'Ledger Replay', href: '/product/ledger'},
  {label: 'Kaizen Queue', href: '/product/kaizen', variant: 'secondary'},
  {label: 'Circuit Memory', href: '/product/circuit-memory', variant: 'secondary'},
  {label: 'Commands', href: '/product/commands', variant: 'ghost'},
  {label: 'Intelligence', href: '/product/intelligence', variant: 'ghost'},
  {label: 'Design Lab', href: '/product/design-lab', variant: 'ghost'},
]

export function AutomationsStudioScreen() {
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()
  const tabPadding = useFloatingTabBarContentPadding()
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
        <ScrollView contentContainerStyle={{gap: spacing[5], padding: spacing[4], paddingBottom: tabPadding}}>
          <View style={{gap: spacing[2]}}>
            <AppText variant="display">Workflows for Profile-OS.</AppText>
            <AppText variant="body" colour="textSecondary">
              Enable drafts locally to inspect how a flow would be shaped. The runner is not wired
              to live accounts in this Preview, so no unattended DMs, CRM writes, unlocks, purchases,
              or remote side effects execute.
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
            <AppText variant="headline">Create flow · dry-run draft only</AppText>
            <AppText variant="caption" colour="textSecondary">
              Saving adds a local draft to this device and marks it enabled for simulation. It does
              not register a background worker, schedule a job, or grant module permissions.
            </AppText>
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
                    <AppText
                      variant="caption"
                      colour={on ? 'accent' : 'textSecondary'}
                      style={styles.wrapText}>
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
                    <AppText
                      variant="caption"
                      colour={on ? 'accent' : 'textSecondary'}
                      style={styles.wrapText}>
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
                  <AppText variant="headline" style={styles.flexText}>
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
                    <AppText variant="body" style={styles.wrapText}>
                      {flow.trigger}
                    </AppText>
                  </Surface>
                  <AppText variant="caption" colour="textTertiary" style={styles.arrowText}>
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
                      },
                    ]}>
                    <AppText variant="caption" colour="textTertiary">
                      ACTIONS
                    </AppText>
                    {flow.actions.map(action => (
                      <AppText
                        key={action}
                        variant="caption"
                        colour="textSecondary"
                        style={styles.wrapText}>
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
              Preview path: trigger intent → Command Layer validation → AKI check → Governor policy
              → Ledger explanation. This is a storyboard for consent and auditability, not a promise
              that the runner has executed or that connected services were touched.
            </AppText>
            <AppText variant="caption" colour="textTertiary">
              Enabled local drafts: {preferences.automationEnabledIds.length || 'none'} · open Ledger
              Replay to inspect seeded audit rows and replay boundaries.
            </AppText>
          </Surface>

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
            <AppText variant="headline">Related workbenches</AppText>
            <AppText variant="body" colour="textSecondary">
              Follow the same dry-run story through replay, improvement capture, memory inspection,
              commands, intelligence, and design-system preview surfaces.
            </AppText>
            <View style={[styles.linkGrid, {gap: spacing[2]}]}>
              {RELATED_LINKS.map(link => (
                <AppButton
                  key={link.label}
                  variant={link.variant ?? 'primary'}
                  onPress={() => router.push(link.href)}
                  style={styles.linkButton}>
                  {link.label}
                </AppButton>
              ))}
            </View>
            <View style={[styles.linkGrid, {gap: spacing[2]}]}>
              <AppButton
                variant="ghost"
                onPress={() => router.push('/marketplace/module-automations' as Href)}
                style={styles.linkButton}>
                Automations module card
              </AppButton>
              <AppButton
                variant="ghost"
                onPress={() => router.push('/product/forge' as Href)}
                style={styles.linkButton}>
                Build nodes in Forge
              </AppButton>
            </View>
          </Surface>
        </ScrollView>
      </ResponsiveContent>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {flex: 1},
  card: {borderWidth: StyleSheet.hairlineWidth},
  titleRow: {alignItems: 'center', flexDirection: 'row'},
  nodeRow: {alignItems: 'stretch', flexDirection: 'row', flexWrap: 'wrap'},
  node: {flexBasis: 220, flexGrow: 1, flexShrink: 1, gap: 4, minWidth: 0},
  input: {borderWidth: StyleSheet.hairlineWidth, minHeight: 44},
  chips: {flexDirection: 'row', flexWrap: 'wrap'},
  chip: {borderWidth: StyleSheet.hairlineWidth, maxWidth: '100%'},
  flexText: {flex: 1, flexShrink: 1, minWidth: 0},
  wrapText: {flexShrink: 1, minWidth: 0},
  arrowText: {alignSelf: 'center'},
  linkGrid: {flexDirection: 'row', flexWrap: 'wrap'},
  linkButton: {flexBasis: 210, flexGrow: 1, minWidth: 0},
})
