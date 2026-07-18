import {ScrollView, StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {AppButton} from '@/components/primitives/AppButton'
import {AppIcon} from '@/components/primitives/AppIcon'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
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

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title="Automations" />
      <ResponsiveContent maxWidth={720}>
        <ScrollView contentContainerStyle={{gap: spacing[5], padding: spacing[4]}}>
          <View style={{gap: spacing[2]}}>
            <AppText variant="display">Workflows for Profile-OS.</AppText>
            <AppText variant="body" colour="textSecondary">
              n8n-style nodes adapted to Modula. Studio Preview — no unattended actions execute yet.
            </AppText>
          </View>

          {FLOWS.map(flow => (
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
                  borderColor: colours.border,
                },
              ]}>
              <View style={[styles.titleRow, {gap: spacing[2]}]}>
                <AppIcon name="automation" colour={colours.accent} />
                <AppText variant="headline">{flow.title}</AppText>
              </View>
              <View style={{gap: spacing[1]}}>
                <AppText variant="caption" colour="textTertiary">
                  TRIGGER
                </AppText>
                <AppText variant="body">{flow.trigger}</AppText>
              </View>
              <View style={{gap: spacing[1]}}>
                <AppText variant="caption" colour="textTertiary">
                  ACTIONS
                </AppText>
                {flow.actions.map(action => (
                  <AppText key={action} variant="body" colour="textSecondary">
                    → {action}
                  </AppText>
                ))}
              </View>
            </Surface>
          ))}

          <AppButton onPress={() => router.push('/marketplace/module-automations' as Href)}>
            Automations module card
          </AppButton>
          <AppButton variant="secondary" onPress={() => router.push('/product/forge' as Href)}>
            Build with Forge (planned)
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
})
