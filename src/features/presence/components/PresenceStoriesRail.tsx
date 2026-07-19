import {LinearGradient} from 'expo-linear-gradient'
import {useRouter, type Href} from 'expo-router'
import {useEffect, useMemo, useRef, useState} from 'react'
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native'
import Animated, {
  Extrapolation,
  FadeIn,
  FadeInDown,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'

import {ProgressiveBlurEdges} from '@/components/materials/ProgressiveBlurEdges'
import {AppText} from '@/components/primitives/AppText'
import {Avatar} from '@/components/primitives/Avatar'
import {
  PRESENCE_RAIL_SEED,
  type PresenceRailPerson,
} from '@/features/presence/data/presenceRailSeed'
import {useReduceMotion} from '@/lib/accessibility'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const ITEM_SLOT = 96
const CENTER_SIZE = 118
const SIDE_SIZE = 72

type PresenceStoriesRailProps = {
  people?: PresenceRailPerson[]
  compact?: boolean
  showCaption?: boolean
}

export function PresenceStoriesRail({
  people = PRESENCE_RAIL_SEED,
  compact = false,
  showCaption = true,
}: PresenceStoriesRailProps) {
  const {colours, spacing, scheme} = useThemeTokens()
  const reduceMotion = useReduceMotion()
  const router = useRouter()
  const {width: windowWidth} = useWindowDimensions()
  const [stageWidth, setStageWidth] = useState(windowWidth)
  const scrollRef = useRef<ScrollView>(null)
  const scrollX = useSharedValue(0)

  const youIndex = useMemo(
    () => Math.max(0, people.findIndex(person => person.id === 'you')),
    [people],
  )

  const sidePad = Math.max(0, (stageWidth - ITEM_SLOT) / 2)

  useEffect(() => {
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({
        x: youIndex * ITEM_SLOT,
        animated: false,
      })
      scrollX.value = youIndex * ITEM_SLOT
    }, 40)
    return () => clearTimeout(timer)
  }, [scrollX, stageWidth, youIndex])

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollX.value = event.nativeEvent.contentOffset.x
  }

  const onStageLayout = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.width
    if (next > 0 && Math.abs(next - stageWidth) > 1) {
      setStageWidth(next)
    }
  }

  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeIn.duration(280)}
      style={[styles.root, compact && styles.rootCompact, {gap: spacing[2]}]}>
      {showCaption ? (
        <View style={[styles.captionRow, {paddingHorizontal: spacing[4], gap: 2}]}>
          <AppText variant="caption" colour="textSecondary">
            PRESENCE
          </AppText>
          <AppText variant="caption" colour="textTertiary">
            Focus halo · Preview — not Instagram Stories
          </AppText>
        </View>
      ) : null}

      <View
        onLayout={onStageLayout}
        style={[
          styles.stage,
          compact ? styles.stageCompact : styles.stageTall,
          {
            backgroundColor:
              scheme === 'dark' ? 'rgba(10,16,18,0.55)' : 'rgba(243,247,248,0.78)',
            borderColor: colours.border,
          },
        ]}>
        <ProgressiveBlurEdges edgeHeight={compact ? 40 : 56} />

        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={ITEM_SLOT}
          decelerationRate="fast"
          contentContainerStyle={{
            paddingHorizontal: sidePad,
            alignItems: 'center',
            minHeight: compact ? 168 : 220,
          }}
          onScroll={onScroll}
          scrollEventThrottle={16}>
          {people.map((person, index) => (
            <PresenceStoryNode
              key={person.id}
              person={person}
              index={index}
              scrollX={scrollX}
              reduceMotion={reduceMotion}
              onPress={() => {
                router.push('/product/presence' as Href)
              }}
            />
          ))}
        </ScrollView>
      </View>
    </Animated.View>
  )
}

function PresenceStoryNode({
  person,
  index,
  scrollX,
  reduceMotion,
  onPress,
}: {
  person: PresenceRailPerson
  index: number
  scrollX: SharedValue<number>
  reduceMotion: boolean
  onPress: () => void
}) {
  const {colours} = useThemeTokens()
  const isYou = person.id === 'you'
  const size = isYou ? CENTER_SIZE : SIDE_SIZE + 8
  const avatarSize = isYou ? CENTER_SIZE - 16 : SIDE_SIZE - 8
  const ringPulse = useSharedValue(1)

  useEffect(() => {
    if (!person.fresh || reduceMotion) return
    ringPulse.value = withRepeat(withTiming(1.06, {duration: 1100}), -1, true)
  }, [person.fresh, reduceMotion, ringPulse])

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{scale: person.fresh && !reduceMotion ? ringPulse.value : 1}],
  }))

  const animatedStyle = useAnimatedStyle(() => {
    const center = index * ITEM_SLOT
    const distance = Math.abs(scrollX.value - center)
    const scale = interpolate(
      distance,
      [0, ITEM_SLOT, ITEM_SLOT * 2],
      [1, 0.72, 0.58],
      Extrapolation.CLAMP,
    )
    const opacity = interpolate(
      distance,
      [0, ITEM_SLOT, ITEM_SLOT * 2.2],
      [1, 0.78, 0.45],
      Extrapolation.CLAMP,
    )
    const translateY = interpolate(
      distance,
      [0, ITEM_SLOT, ITEM_SLOT * 2],
      [0, 10, 18],
      Extrapolation.CLAMP,
    )
    return {
      transform: [{scale}, {translateY}],
      opacity,
    }
  })

  const labelStyle = useAnimatedStyle(() => {
    const distance = Math.abs(scrollX.value - index * ITEM_SLOT)
    const opacity = interpolate(
      distance,
      [0, ITEM_SLOT * 0.55, ITEM_SLOT],
      [0, 0.55, 1],
      Extrapolation.CLAMP,
    )
    return {opacity}
  })

  const addStyle = useAnimatedStyle(() => {
    const distance = Math.abs(scrollX.value - index * ITEM_SLOT)
    const opacity = interpolate(distance, [0, ITEM_SLOT * 0.4], [1, 0], Extrapolation.CLAMP)
    const translateY = interpolate(distance, [0, ITEM_SLOT * 0.4], [0, 8], Extrapolation.CLAMP)
    return {
      opacity,
      transform: [{translateY}],
    }
  })

  return (
    <Animated.View
      entering={
        reduceMotion ? undefined : FadeInDown.delay(index * 36).springify().damping(18)
      }
      style={[styles.slot, animatedStyle]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          isYou
            ? 'Your presence focus. Add Presence.'
            : `${person.name}. ${person.fresh ? 'Fresh presence.' : 'Open presence.'}`
        }
        onPress={onPress}
        style={styles.nodePress}>
        <Animated.View
          style={[styles.ring, pulseStyle, {width: size, height: size, borderRadius: 999}]}>
          {person.fresh || isYou ? (
            <LinearGradient
              colors={
                isYou
                  ? ['#FF4D8D', '#369CAA', '#2A6F78', 'transparent']
                  : ['#369CAA', '#5C9AA8', 'transparent', 'transparent']
              }
              start={{x: 0, y: 0}}
              end={{x: 1, y: 1}}
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <View
              style={[
                StyleSheet.absoluteFill,
                {
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: colours.border,
                  borderRadius: 999,
                },
              ]}
            />
          )}
          <View
            style={[
              styles.avatarInset,
              {
                backgroundColor: colours.canvas,
                width: avatarSize + 8,
                height: avatarSize + 8,
                borderRadius: 999,
              },
            ]}>
            <Avatar name={person.name} uri={person.uri} size={avatarSize} colour={person.colour} />
          </View>
        </Animated.View>

        {isYou ? (
          <Animated.View style={[styles.addWrap, addStyle]}>
            <AppText
              variant="caption"
              colour="accent"
              numberOfLines={1}
              style={styles.name}>
              Add Presence
            </AppText>
          </Animated.View>
        ) : (
          <Animated.View style={labelStyle}>
            <AppText
              variant="caption"
              colour="textSecondary"
              numberOfLines={1}
              style={styles.name}>
              {person.name}
            </AppText>
          </Animated.View>
        )}
      </Pressable>
    </Animated.View>
  )
}


const styles = StyleSheet.create({
  root: {
    marginBottom: 4,
  },
  rootCompact: {
    marginBottom: 0,
  },
  captionRow: {},
  stage: {
    overflow: 'hidden',
    borderRadius: 28,
    marginHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  stageTall: {
    minHeight: 248,
    paddingBottom: 12,
  },
  stageCompact: {
    minHeight: 196,
    paddingBottom: 10,
  },
  slot: {
    width: ITEM_SLOT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodePress: {
    alignItems: 'center',
    gap: 10,
    width: ITEM_SLOT,
  },
  ring: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarInset: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  name: {
    textAlign: 'center',
    maxWidth: ITEM_SLOT - 8,
  },
  addWrap: {
    minHeight: 20,
    justifyContent: 'center',
  },
})
