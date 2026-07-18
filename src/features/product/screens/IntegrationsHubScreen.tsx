import {ScrollView, StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {AppButton} from '@/components/primitives/AppButton'
import {AppIcon, type AppIconName} from '@/components/primitives/AppIcon'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const TARGETS: Array<{name: string; icon: AppIconName; kind: string}> = [
  {name: 'Salesforce', icon: 'people', kind: 'CRM'},
  {name: 'Perfex CRM', icon: 'people', kind: 'CRM'},
  {name: 'Element / Matrix', icon: 'messages', kind: 'Messaging'},
  {name: 'Google Calendar', icon: 'event', kind: 'Calendar'},
  {name: 'Notion', icon: 'saved', kind: 'Knowledge'},
  {name: 'Trello', icon: 'check', kind: 'Tasks'},
  {name: 'LinkedIn', icon: 'link', kind: 'Social'},
  {name: 'Instagram', icon: 'photo', kind: 'Social'},
  {name: 'X', icon: 'text', kind: 'Social'},
  {name: 'Email providers', icon: 'messages', kind: 'Mail'},
  {name: 'Storage services', icon: 'storage', kind: 'Files'},
  {name: 'Automation APIs', icon: 'automation', kind: 'Flows'},
]

export function IntegrationsHubScreen() {
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title="Integrations" />
      <ResponsiveContent maxWidth={720}>
        <ScrollView contentContainerStyle={{gap: spacing[5], padding: spacing[4]}}>
          <View style={{gap: spacing[2]}}>
            <AppText variant="display">Connect tools. Don’t abandon them.</AppText>
            <AppText variant="body" colour="textSecondary">
              Integrations appear as Elements, modules, widgets, or automation nodes. Catalogue
              Preview — live OAuth only where Connections already supports it.
            </AppText>
          </View>

          <View style={[styles.grid, {gap: spacing[3]}]}>
            {TARGETS.map(item => (
              <Surface
                key={item.name}
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
                <AppIcon name={item.icon} colour={colours.accent} />
                <AppText variant="headline">{item.name}</AppText>
                <AppText variant="caption" colour="textTertiary">
                  {item.kind} · Planned Element
                </AppText>
              </Surface>
            ))}
          </View>

          <AppButton onPress={() => router.push('/settings/connections' as Href)}>
            Open Connections
          </AppButton>
          <AppButton variant="secondary" onPress={() => router.push('/product/automations' as Href)}>
            Automation nodes
          </AppButton>
        </ScrollView>
      </ResponsiveContent>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {flex: 1},
  grid: {flexDirection: 'row', flexWrap: 'wrap'},
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    flexBasis: '47%',
    flexGrow: 1,
    minWidth: 150,
  },
})
