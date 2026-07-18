import {useState} from 'react'
import {Pressable, ScrollView, StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {AppButton} from '@/components/primitives/AppButton'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import {PresenceArc} from '@/features/onboarding/components/PresenceArc'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const ARCS = [
  {id: 'a', label: 'Inner', icon: 'people' as const, unread: true, blurb: 'Inner Circle presence'},
  {id: 'b', label: 'Focus', icon: 'contrast' as const, unread: true, blurb: 'Focus Halo availability'},
  {id: 'c', label: 'You', icon: 'profile' as const, unread: false, blurb: 'Your presence ring'},
  {id: 'd', label: 'Team', icon: 'teams' as const, unread: false, blurb: 'Team shared presence'},
  {id: 'e', label: 'Live', icon: 'play' as const, unread: true, blurb: 'Live rooms — planned'},
]

export function StoriesPresenceScreen() {
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()
  const [selectedId, setSelectedId] = useState(ARCS[0].id)
  const selected = ARCS.find(item => item.id === selectedId) ?? ARCS[0]

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
            items={ARCS.map(({id, label, icon, unread}) => ({id, label, icon, unread}))}
          />

          <View style={[styles.chips, {gap: spacing[2]}]}>
            {ARCS.map(item => {
              const on = item.id === selectedId
              return (
                <Pressable key={item.id} onPress={() => setSelectedId(item.id)}>
                  <Surface
                    variant="contained"
                    style={[
                      styles.chip,
                      {
                        paddingHorizontal: spacing[3],
                        paddingVertical: spacing[2],
                        borderRadius: radius.round,
                        backgroundColor: on ? colours.accentSubtle : colours.surface,
                        borderColor: on ? colours.accent : colours.border,
                      },
                    ]}>
                    <AppText variant="caption" colour={on ? 'accent' : 'text'}>
                      {item.label}
                    </AppText>
                  </Surface>
                </Pressable>
              )
            })}
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
              RING
            </AppText>
            <AppText variant="headline">{selected.label}</AppText>
            <AppText variant="body" colour="textSecondary">
              {selected.blurb}
            </AppText>
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
  chips: {flexDirection: 'row', flexWrap: 'wrap'},
  chip: {borderWidth: StyleSheet.hairlineWidth},
  card: {borderWidth: StyleSheet.hairlineWidth},
})
