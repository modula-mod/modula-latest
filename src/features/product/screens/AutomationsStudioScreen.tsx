import {ScrollView, StyleSheet, Switch, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {AppButton} from '@/components/primitives/AppButton'
import {AppIcon} from '@/components/primitives/AppIcon'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import {useProductPreferences} from '@/features/product/hooks/useProductPreferences'
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

export function AutomationsStudioScreen() {
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()
  const {preferences, update} = useProductPreferences()
  const enabled = new Set(preferences.automationEnabledIds)

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

          {FLOWS.map(flow => {
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

          <AppButton onPress={() => router.push('/marketplace/module-automations' as Href)}>
            Automations module card
          </AppButton>
          <AppButton variant="secondary" onPress={() => router.push('/product/forge' as Href)}>
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
})
