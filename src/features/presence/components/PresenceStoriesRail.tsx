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
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
} from 'react-native-svg'

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
const DIAL_STROKE = 3.5

type PresenceStoriesRailProps = {
  people?: PresenceRailPerson[]
  compact?: boolean
  showCaption?: boolean
}

/**
 * Home stories rail — focus-scaled carousel with dial rings (full circle stroke).
 * Copy is Stories; route still opens the Presence preview surface.
 */
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
        <View
          style={[
            styles.captionRow,
            {paddingHorizontal: spacing[4], gap: 2},
          ]}>
          <AppText variant="caption" colour="textSecondary">
            STORIES
          </AppText>
          <AppText variant="caption" colour="textTertiary">
            Dial rings · Preview
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
              scheme === 'dark'
                ? 'rgba(10,16,18,0.55)'
                : 'rgba(243,247,248,0.78)',
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
            <StoryNode
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

function StoryDial({
  id,
  size,
  active,
  isYou,
  mutedStroke,
}: {
  id: string
  size: number
  active: boolean
  isYou: boolean
  mutedStroke: string
}) {
  const stroke = DIAL_STROKE
  const r = (size - stroke) / 2
  const c = size / 2
  const gradientId = `story-dial-${id}`

  if (!active && !isYou) {
    return (
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle
          cx={c}
          cy={c}
          r={r}
          stroke={mutedStroke}
          strokeWidth={StyleSheet.hairlineWidth * 2}
          fill="none"
        />
      </Svg>
    )
  }

  // Full dial ring — continuous stroke (not a filled wedge / partial arc).
  return (
    <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
      <Defs>
        <SvgLinearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#FF5A7A" />
          <Stop offset="45%" stopColor="#369CAA" />
          <Stop offset="100%" stopColor="#E8A838" />
        </SvgLinearGradient>
      </Defs>
      <Circle
        cx={c}
        cy={c}
        r={r}
        stroke={`url(#${gradientId})`}
        strokeWidth={stroke}
        fill="none"
        strokeLinecap="round"
        // Slight dash breaks make the ring read as a dial, not a blob.
        strokeDasharray={isYou ? undefined : `${r * 0.55} ${r * 0.18}`}
      />
    </Svg>
  )
}

function StoryNode({
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
  const avatarSize = isYou ? CENTER_SIZE - 22 : SIDE_SIZE - 14
  const ringPulse = useSharedValue(1)

  useEffect(() => {
    if (!person.fresh || reduceMotion) return
    ringPulse.value = withRepeat(withTiming(1.04, {duration: 1400}), -1, true)
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
    const opacity = interpolate(
      distance,
      [0, ITEM_SLOT * 0.4],
      [1, 0],
      Extrapolation.CLAMP,
    )
    const translateY = interpolate(
      distance,
      [0, ITEM_SLOT * 0.4],
      [0, 8],
      Extrapolation.CLAMP,
    )
    return {
      opacity,
      transform: [{translateY}],
    }
  })

  return (
    <Animated.View
      entering={
        reduceMotion
          ? undefined
          : FadeInDown.delay(index * 36).springify().damping(18)
      }
      style={[styles.slot, animatedStyle]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          isYou
            ? 'Your story. Add Story.'
            : `${person.name}. ${person.fresh ? 'Unread story.' : 'Open story.'}`
        }
        onPress={onPress}
        style={styles.nodePress}>
        <Animated.View
          style={[
            styles.ring,
            pulseStyle,
            {width: size, height: size, borderRadius: size / 2},
          ]}>
          <StoryDial
            id={person.id}
            size={size}
            active={person.fresh || isYou}
            isYou={isYou}
            mutedStroke={colours.border}
          />
          <View
            style={[
              styles.avatarInset,
              {
                backgroundColor: colours.canvas,
                width: avatarSize + 6,
                height: avatarSize + 6,
                borderRadius: 999,
              },
            ]}>
            <Avatar
              name={person.name}
              uri={person.uri}
              size={avatarSize}
              colour={person.colour}
              style={styles.avatarBare}
            />
          </View>
        </Animated.View>

        {isYou ? (
          <Animated.View style={[styles.addWrap, addStyle]}>
            <AppText
              variant="caption"
              colour="accent"
              numberOfLines={1}
              style={styles.name}>
              Add Story
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
  addWrap: {
    justifyContent: 'center',
    minHeight: 20,
  },
  avatarBare: {
    borderWidth: 0,
  },
  avatarInset: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    zIndex: 1,
  },
  captionRow: {},
  name: {
    maxWidth: ITEM_SLOT - 8,
    textAlign: 'center',
  },
  nodePress: {
    alignItems: 'center',
    gap: 10,
    width: ITEM_SLOT,
  },
  ring: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  root: {
    marginBottom: 4,
  },
  rootCompact: {
    marginBottom: 0,
  },
  slot: {
    alignItems: 'center',
    justifyContent: 'center',
    width: ITEM_SLOT,
  },
  stage: {
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    marginHorizontal: 12,
    overflow: 'hidden',
  },
  stageCompact: {
    minHeight: 196,
    paddingBottom: 10,
  },
  stageTall: {
    minHeight: 248,
    paddingBottom: 12,
  },
})
