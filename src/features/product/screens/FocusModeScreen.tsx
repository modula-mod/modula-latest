import {ScrollView, StyleSheet, Switch, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {AppButton} from '@/components/primitives/AppButton'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import {PresenceArc} from '@/features/onboarding/components/PresenceArc'
import {useProductPreferences} from '@/features/product/hooks/useProductPreferences'
import type {FocusPreferences} from '@/features/product/storage/productPreferencesStorage'
import {useProfile} from '@/features/profile/runtime/useProfile'
import {useProfileActions} from '@/features/profile/runtime/useProfileActions'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const ROWS: Array<{id: keyof FocusPreferences; label: string; description: string}> = [
  {
    id: 'quietFeed',
    label: 'Quiet the feed',
    description: 'Prefer Following and mute algorithmic noise.',
  },
  {
    id: 'hideNav',
    label: 'Hide secondary navigation',
    description: 'Keep Board, Messages, and active modules.',
  },
  {
    id: 'suppressPings',
    label: 'Suppress social pings',
    description: 'Allow mentions and DMs from Inner Circle only.',
  },
  {
    id: 'priorityWork',
    label: 'Prioritise Tasks + CRM',
    description: 'Surface work modules above Discover.',
  },
  {
    id: 'showHalo',
    label: 'Show Focus Halo',
    description: 'Signal availability on your avatar.',
  },
]

export function FocusModeScreen() {
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()
  const {preferences, ready, update} = useProductPreferences()
  const focus = preferences.focus
  const {presentation} = useProfile()
  const {setProfilePresentation} = useProfileActions()

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title="Focus Mode" />
      <ResponsiveContent maxWidth={720}>
        <ScrollView contentContainerStyle={{gap: spacing[5], padding: spacing[4]}}>
          <View style={{gap: spacing[2]}}>
            <AppText variant="display">Protect attention across the Shell.</AppText>
            <AppText variant="body" colour="textSecondary">
              Preferences persist locally on this device until Greenfield sync lands.
              {!ready ? ' Loading…' : ''}
            </AppText>
          </View>

          <PresenceArc
            centreLabel={focus.showHalo ? 'Focused' : 'Available'}
            items={[
              {id: 'feed', label: 'Feed', icon: 'home', unread: !focus.quietFeed},
              {id: 'board', label: 'Board', icon: 'board', unread: true},
              {id: 'you', label: 'You', icon: 'profile', unread: focus.showHalo},
              {id: 'tasks', label: 'Tasks', icon: 'check'},
              {id: 'crm', label: 'CRM', icon: 'people'},
            ]}
          />

          <View style={{gap: spacing[3]}}>
            {ROWS.map(item => (
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
                  value={focus[item.id]}
                  onValueChange={value => {
                    void update({focus: {...focus, [item.id]: value}})
                    if (item.id === 'showHalo') {
                      setProfilePresentation({
                        ...presentation,
                        showFocusHalo: value,
                      })
                    }
                  }}
                />
              </Surface>
            ))}
          </View>

          <AppButton onPress={() => router.push('/board' as Href)}>Open Board</AppButton>
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
