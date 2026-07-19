import {LinearGradient} from 'expo-linear-gradient'
import {ScrollView, StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {AppIcon} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {LIVE_PRESENCE_ROOMS} from '@/features/discover/data/inspireSeed'
import {PresenceStoriesRail} from '@/features/presence/components/PresenceStoriesRail'
import {selectionHaptic} from '@/lib/haptics'
import {SectionEnter} from '@/platform/ui/motion/section-enter'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

/** Live Presence rooms — Preview only; opens Presence craft, not a stream backend. */
export default function DiscoverLiveRoute() {
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title="Live Presence" />
      <ResponsiveContent>
        <ScrollView
          contentContainerStyle={{
            gap: spacing[5],
            paddingBottom: spacing[8],
          }}>
          <SectionEnter>
            <View style={{gap: spacing[2], paddingHorizontal: spacing[4]}}>
              <AppText variant="body" colour="textSecondary">
                Presence rooms Preview — Focus Halo hosts and craft sessions. No live stream
                backend in this build.
              </AppText>
            </View>
          </SectionEnter>

          <SectionEnter delay={60}>
            <PresenceStoriesRail compact showCaption={false} />
          </SectionEnter>

          <View style={{gap: spacing[3], paddingHorizontal: spacing[4]}}>
            <SectionEnter delay={100}>
              <AppText variant="headline">Rooms</AppText>
            </SectionEnter>
            {LIVE_PRESENCE_ROOMS.map((room, index) => (
              <SectionEnter key={room.id} delay={120 + index * 40}>
                <AppPressable
                  accessibilityLabel={`${room.live ? 'Live' : 'Upcoming'} ${room.title}`}
                  onPress={() => {
                    void selectionHaptic()
                    router.push('/product/presence' as Href)
                  }}
                  style={[
                    styles.card,
                    {
                      backgroundColor: colours.surfaceRaised,
                      borderColor: colours.border,
                      borderRadius: radius.xlarge,
                      overflow: 'hidden',
                    },
                  ]}>
                  <View style={[styles.hero, {backgroundColor: room.colour}]}>
                    <LinearGradient
                      colors={['transparent', 'rgba(0,0,0,0.5)']}
                      style={StyleSheet.absoluteFill}
                    />
                    <View
                      style={[
                        styles.badge,
                        {
                          backgroundColor: room.live
                            ? colours.accent
                            : 'rgba(255,255,255,0.22)',
                          borderRadius: radius.round,
                        },
                      ]}>
                      <AppText
                        variant="caption"
                        style={{
                          color: room.live ? colours.accentForeground : '#FFFFFF',
                        }}>
                        {room.live ? 'LIVE' : 'Soon'}
                      </AppText>
                    </View>
                    <AppText variant="caption" style={{color: '#FFFFFF'}}>
                      {room.viewersLabel} watching
                    </AppText>
                  </View>
                  <View
                    style={[
                      styles.meta,
                      {gap: spacing[2], padding: spacing[3]},
                    ]}>
                    <View style={{flex: 1, gap: 2}}>
                      <AppText variant="label">{room.title}</AppText>
                      <AppText variant="caption" colour="textSecondary">
                        Hosted by {room.host}
                      </AppText>
                    </View>
                    <View
                      style={[
                        styles.join,
                        {
                          backgroundColor: colours.accent,
                          borderRadius: radius.round,
                        },
                      ]}>
                      <AppIcon name="play" colour={colours.accentForeground} size={14} />
                      <AppText
                        variant="label"
                        style={{color: colours.accentForeground}}>
                        Open
                      </AppText>
                    </View>
                  </View>
                </AppPressable>
              </SectionEnter>
            ))}
          </View>
        </ScrollView>
      </ResponsiveContent>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    justifyContent: 'center',
    minHeight: 22,
    paddingHorizontal: 8,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  hero: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    height: 96,
    justifyContent: 'space-between',
    padding: 12,
  },
  join: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 12,
  },
  meta: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  screen: {flex: 1},
})
