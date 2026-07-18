import {useState} from 'react'
import {ScrollView, StyleSheet, Switch, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {AppButton} from '@/components/primitives/AppButton'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import {PresenceArc} from '@/features/onboarding/components/PresenceArc'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type FocusToggle = {id: string; label: string; description: string; value: boolean}

export function FocusModeScreen() {
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()
  const [toggles, setToggles] = useState<FocusToggle[]>([
    {
      id: 'quiet-feed',
      label: 'Quiet the feed',
      description: 'Prefer Following and mute algorithmic noise.',
      value: true,
    },
    {
      id: 'hide-nav',
      label: 'Hide secondary navigation',
      description: 'Keep Board, Messages, and active modules.',
      value: false,
    },
    {
      id: 'suppress',
      label: 'Suppress social pings',
      description: 'Allow mentions and DMs from Inner Circle only.',
      value: true,
    },
    {
      id: 'priority',
      label: 'Prioritise Tasks + CRM',
      description: 'Surface work modules above Discover.',
      value: true,
    },
    {
      id: 'halo',
      label: 'Show Focus Halo',
      description: 'Signal availability on your avatar.',
      value: true,
    },
  ])

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title="Focus Mode" />
      <ResponsiveContent maxWidth={720}>
        <ScrollView contentContainerStyle={{gap: spacing[5], padding: spacing[4]}}>
          <View style={{gap: spacing[2]}}>
            <AppText variant="display">Protect attention across the Shell.</AppText>
            <AppText variant="body" colour="textSecondary">
              Focus Mode is local Preview — preferences stay on device until Greenfield sync lands.
            </AppText>
          </View>

          <PresenceArc
            centreLabel={toggles.find(t => t.id === 'halo')?.value ? 'Focused' : 'Available'}
            items={[
              {id: 'feed', label: 'Feed', icon: 'home', unread: !toggles[0]?.value},
              {id: 'board', label: 'Board', icon: 'board', unread: true},
              {id: 'you', label: 'You', icon: 'profile', unread: toggles.find(t => t.id === 'halo')?.value},
              {id: 'tasks', label: 'Tasks', icon: 'check'},
              {id: 'crm', label: 'CRM', icon: 'people'},
            ]}
          />

          <View style={{gap: spacing[3]}}>
            {toggles.map((item, index) => (
              <Surface
                key={item.id}
                variant="contained"
                style={[
                  styles.row,
                  {
                    padding: spacing[4],
                    borderRadius: radius.medium,
                    borderColor: colours.border,
                    backgroundColor: colours.surface,
                    gap: spacing[3],
                  },
                ]}>
                <View style={{flex: 1, gap: spacing[1]}}>
                  <AppText variant="headline">{item.label}</AppText>
                  <AppText variant="caption" colour="textSecondary">
                    {item.description}
                  </AppText>
                </View>
                <Switch
                  accessibilityLabel={item.label}
                  value={item.value}
                  onValueChange={value => {
                    setToggles(prev =>
                      prev.map((row, i) => (i === index ? {...row, value} : row)),
                    )
                  }}
                />
              </Surface>
            ))}
          </View>

          <AppButton onPress={() => router.push('/board' as Href)}>Apply on Board</AppButton>
          <AppButton variant="secondary" onPress={() => router.push('/profile/customize' as Href)}>
            Focus Halo on profile
          </AppButton>
        </ScrollView>
      </ResponsiveContent>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {flex: 1},
  row: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
  },
})
