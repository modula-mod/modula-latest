import {useMemo, useState} from 'react'
import {ScrollView, StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {AppButton} from '@/components/primitives/AppButton'
import {AppIcon, type AppIconName} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const KINDS = ['All', 'CRM', 'Messaging', 'Calendar', 'Knowledge', 'Tasks', 'Social', 'Mail', 'Files', 'Flows'] as const

const TARGETS: Array<{name: string; icon: AppIconName; kind: (typeof KINDS)[number]}> = [
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
  const [kind, setKind] = useState<(typeof KINDS)[number]>('All')
  const [pinned, setPinned] = useState<string[]>(['Notion', 'Google Calendar'])

  const visible = useMemo(
    () => (kind === 'All' ? TARGETS : TARGETS.filter(item => item.kind === kind)),
    [kind],
  )

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title="Integrations" />
      <ResponsiveContent maxWidth={720}>
        <ScrollView contentContainerStyle={{gap: spacing[5], padding: spacing[4]}}>
          <View style={{gap: spacing[2]}}>
            <AppText variant="display">Connect tools. Don’t abandon them.</AppText>
            <AppText variant="body" colour="textSecondary">
              Integrations appear as Elements, modules, widgets, or automation nodes. Catalogue
              Preview — live OAuth only where Connections already supports it. Pin locally for
              planning.
            </AppText>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={[styles.kinds, {gap: spacing[2]}]}>
              {KINDS.map(item => {
                const on = item === kind
                return (
                  <AppPressable
                    key={item}
                    accessibilityLabel={`Filter ${item}`}
                    onPress={() => setKind(item)}
                    style={[
                      styles.kind,
                      {
                        paddingHorizontal: spacing[3],
                        paddingVertical: spacing[2],
                        borderRadius: radius.round,
                        backgroundColor: on ? colours.accentSubtle : colours.surface,
                        borderColor: on ? colours.accent : colours.border,
                      },
                    ]}>
                    <AppText variant="caption" colour={on ? 'accent' : 'text'}>
                      {item}
                    </AppText>
                  </AppPressable>
                )
              })}
            </View>
          </ScrollView>

          <View style={[styles.grid, {gap: spacing[3]}]}>
            {visible.map(item => {
              const on = pinned.includes(item.name)
              return (
                <AppPressable
                  key={item.name}
                  accessibilityLabel={`${on ? 'Unpin' : 'Pin'} ${item.name}`}
                  onPress={() =>
                    setPinned(current =>
                      on ? current.filter(name => name !== item.name) : [...current, item.name],
                    )
                  }
                  style={[
                    styles.card,
                    {
                      padding: spacing[4],
                      gap: spacing[2],
                      borderRadius: radius.large,
                      backgroundColor: on ? colours.accentSubtle : colours.surface,
                      borderColor: on ? colours.accent : colours.border,
                    },
                  ]}>
                  <AppIcon name={item.icon} colour={colours.accent} />
                  <AppText variant="headline">{item.name}</AppText>
                  <AppText variant="caption" colour="textTertiary">
                    {item.kind} · {on ? 'Pinned locally' : 'Planned Element'}
                  </AppText>
                </AppPressable>
              )
            })}
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
  kinds: {flexDirection: 'row'},
  kind: {borderWidth: StyleSheet.hairlineWidth},
  grid: {flexDirection: 'row', flexWrap: 'wrap'},
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    flexBasis: '47%',
    flexGrow: 1,
    minWidth: 150,
  },
})
