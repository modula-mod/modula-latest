import {ScrollView, StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {AppButton} from '@/components/primitives/AppButton'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import {PresenceArc} from '@/features/onboarding/components/PresenceArc'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function StoriesPresenceScreen() {
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title="Presence" />
      <ResponsiveContent maxWidth={720}>
        <ScrollView contentContainerStyle={{gap: spacing[5], padding: spacing[4]}}>
          <View style={{gap: spacing[2]}}>
            <AppText variant="display">Presence — not Instagram Stories.</AppText>
            <AppText variant="body" colour="textSecondary">
              Short-form and live experiences are planned social capabilities. The arc below maps to
              Focus, modules, and Inner Circle — not a clone of ephemeral social as the core product.
            </AppText>
          </View>

          <PresenceArc
            centreLabel="Add presence"
            items={[
              {id: 'a', label: 'Inner', icon: 'people', unread: true},
              {id: 'b', label: 'Focus', icon: 'contrast', unread: true},
              {id: 'c', label: 'You', icon: 'profile'},
              {id: 'd', label: 'Team', icon: 'teams'},
              {id: 'e', label: 'Live', icon: 'play'},
            ]}
          />

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
            <AppText variant="headline">Planned experiences</AppText>
            <AppText variant="body" colour="textSecondary">
              · Ephemeral presence updates{'\n'}
              · Short-form media (/reels preview){'\n'}
              · Live rooms tied to Teams{'\n'}
              · Focus Halo availability
            </AppText>
          </Surface>

          <AppButton onPress={() => router.push('/reels' as Href)}>Open Reels preview</AppButton>
          <AppButton variant="secondary" onPress={() => router.push('/product/focus' as Href)}>
            Focus Mode
          </AppButton>
        </ScrollView>
      </ResponsiveContent>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {flex: 1},
  card: {borderWidth: StyleSheet.hairlineWidth},
})
