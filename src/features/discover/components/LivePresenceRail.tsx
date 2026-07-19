import {LinearGradient} from 'expo-linear-gradient'
import {ScrollView, StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import {useEffect} from 'react'

import {AppIcon} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {
  LIVE_PRESENCE_ROOMS,
  type LivePresenceRoom,
} from '@/features/discover/data/inspireSeed'
import {useReduceMotion} from '@/lib/accessibility'
import {selectionHaptic} from '@/lib/haptics'
import {SectionEnter} from '@/platform/ui/motion/section-enter'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type LivePresenceRailProps = {
  onSeeAll?: () => void
}

/** Horizontal “Live presence” cards — Preview rooms, not a live streaming product. */
export function LivePresenceRail({onSeeAll}: LivePresenceRailProps) {
  const router = useRouter()
  const {colours, spacing} = useThemeTokens()

  return (
    <SectionEnter delay={80}>
      <View style={{gap: spacing[3]}}>
        <View style={styles.header}>
          <AppText variant="headline">Live presence</AppText>
          <AppPressable
            accessibilityLabel="See all live presence rooms"
            onPress={() => {
              void selectionHaptic()
              if (onSeeAll) {
                onSeeAll()
                return
              }
              router.push('/discover/live' as Href)
            }}
            style={styles.seeAll}>
            <AppText variant="label" colour="accent">
              See all
            </AppText>
            <AppIcon name="chevronRight" colour={colours.accent} size={16} />
          </AppPressable>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{gap: spacing[3]}}>
          {LIVE_PRESENCE_ROOMS.map((room, index) => (
            <LiveRoomCard key={room.id} room={room} index={index} />
          ))}
        </ScrollView>
      </View>
    </SectionEnter>
  )
}

function LiveRoomCard({room, index}: {room: LivePresenceRoom; index: number}) {
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()
  const reduceMotion = useReduceMotion()
  const pulse = useSharedValue(1)

  useEffect(() => {
    if (!room.live || reduceMotion) return
    pulse.value = withRepeat(withTiming(1.08, {duration: 900}), -1, true)
  }, [pulse, reduceMotion, room.live])

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{scale: room.live && !reduceMotion ? pulse.value : 1}],
  }))

  return (
    <SectionEnter delay={100 + index * 40} from="right">
      <AppPressable
        accessibilityLabel={`${room.live ? 'Live' : 'Upcoming'}: ${room.title}`}
        onPress={() => {
          void selectionHaptic()
          router.push('/discover/live' as Href)
        }}
        style={[
          styles.card,
          {
            backgroundColor: room.colour,
            borderRadius: radius.xlarge,
            padding: spacing[3],
          },
        ]}>
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.45)']}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.cardTop}>
          {room.live ? (
            <Animated.View
              style={[
                styles.livePill,
                pulseStyle,
                {backgroundColor: colours.accent, borderRadius: radius.round},
              ]}>
              <AppText variant="caption" style={{color: colours.accentForeground}}>
                LIVE
              </AppText>
            </Animated.View>
          ) : (
            <View
              style={[
                styles.livePill,
                {
                  backgroundColor: 'rgba(255,255,255,0.22)',
                  borderRadius: radius.round,
                },
              ]}>
              <AppText variant="caption" style={{color: '#FFFFFF'}}>
                Soon
              </AppText>
            </View>
          )}
          <AppText variant="caption" style={{color: 'rgba(255,255,255,0.9)'}}>
            {room.viewersLabel}
          </AppText>
        </View>
        <View style={{gap: 4}}>
          <AppText variant="label" style={{color: '#FFFFFF'}} numberOfLines={2}>
            {room.title}
          </AppText>
          <AppText variant="caption" style={{color: 'rgba(255,255,255,0.8)'}}>
            {room.host}
          </AppText>
        </View>
      </AppPressable>
    </SectionEnter>
  )
}

const styles = StyleSheet.create({
  card: {
    height: 168,
    justifyContent: 'space-between',
    overflow: 'hidden',
    width: 168,
  },
  cardTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  livePill: {
    minHeight: 22,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  seeAll: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 2,
    minHeight: 44,
  },
})
