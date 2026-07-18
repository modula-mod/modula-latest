import {useState} from 'react'
import {Pressable, ScrollView, StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {AppButton} from '@/components/primitives/AppButton'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import {PresenceStoriesRail} from '@/features/presence/components/PresenceStoriesRail'
import {PRESENCE_RAIL_SEED} from '@/features/presence/data/presenceRailSeed'
import {PresenceArc} from '@/features/onboarding/components/PresenceArc'
import {ModulaJoinIsland} from '@/platform/ui/motion'
import {useFloatingTabBarContentPadding} from '@/platform/ui/navigation/floating-tab-bar-inset'
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
  const tabPadding = useFloatingTabBarContentPadding()
  const [selectedId, setSelectedId] = useState(ARCS[0].id)
  const selected = ARCS.find(item => item.id === selectedId) ?? ARCS[0]

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title="Presence" />
      <ResponsiveContent maxWidth={720}>
        <ScrollView
          contentContainerStyle={{
            gap: spacing[5],
            paddingBottom: tabPadding,
          }}>
          <View style={{gap: spacing[2], paddingHorizontal: spacing[4]}}>
            <AppText variant="body" colour="textSecondary">
              Focus Halo rail Preview — not Instagram Stories. Centre-focus avatars, gradient rings,
              and progressive blur stage the presence strip.
            </AppText>
          </View>

          <PresenceStoriesRail showCaption={false} />

          <View style={{gap: spacing[2], paddingHorizontal: spacing[4]}}>
            <AppText variant="headline">Join island</AppText>
            <AppText variant="body" colour="textSecondary">
              Telegram-style join pop — avatar emerges from a Dynamic Island meatball
              (Motionary Preview). Scroll the stage or tap Simulate join.
            </AppText>
          </View>
          <View style={{paddingHorizontal: spacing[4]}}>
            <ModulaJoinIsland
              name={PRESENCE_RAIL_SEED[0]?.name ?? 'Maya Okonkwo'}
              avatarColour={PRESENCE_RAIL_SEED[0]?.colour}
              caption="Presence join Preview — not a live call surface."
            />
          </View>

          <View style={{gap: spacing[2], paddingHorizontal: spacing[4]}}>
            <AppText variant="headline">Spaces arc</AppText>
            <AppText variant="body" colour="textSecondary">
              Module and Focus shortcuts stay on the icon arc — separate from the people rail.
            </AppText>
          </View>

          <PresenceArc
            centreLabel="Add presence"
            items={ARCS.map(({id, label, icon, unread}) => ({id, label, icon, unread}))}
            onItemPress={id => setSelectedId(id)}
            onCentrePress={() => setSelectedId('c')}
          />

          <View style={[styles.chips, {gap: spacing[2], paddingHorizontal: spacing[4]}]}>
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
                marginHorizontal: spacing[4],
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

          <View style={{paddingHorizontal: spacing[4], gap: spacing[3]}}>
            <AppButton onPress={() => router.push('/reels' as Href)}>Open Reels preview</AppButton>
            <AppButton variant="secondary" onPress={() => router.push('/product/focus' as Href)}>
              Focus Mode
            </AppButton>
          </View>
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
