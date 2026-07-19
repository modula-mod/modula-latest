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
  Defs,
  LinearGradient as SvgLinearGradient,
  Path,
  Stop,
} from 'react-native-svg'

import {AppText} from '@/components/primitives/AppText'
import {Avatar} from '@/components/primitives/Avatar'
import {
  PRESENCE_RAIL_SEED,
  type PresenceRailPerson,
} from '@/features/presence/data/presenceRailSeed'
import {useReduceMotion} from '@/lib/accessibility'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const ITEM_SLOT = 100
const CENTER_SIZE = 124
const SIDE_SIZE = 78

type PresenceStoriesRailProps = {
  people?: PresenceRailPerson[]
  compact?: boolean
  showCaption?: boolean
}

/**
 * Home Stories rail — open (no card), focus-scaled carousel.
 * Side nodes: thick gradient dial arc. Center: thin full ring + Add Story pill.
 */
export function PresenceStoriesRail({
  people = PRESENCE_RAIL_SEED,
  compact = false,
  showCaption = true,
}: PresenceStoriesRailProps) {
  const {spacing} = useThemeTokens()
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
      style={[styles.root, compact && styles.rootCompact, {gap: spacing[1]}]}>
      {showCaption ? (
        <View
          style={[
            styles.captionRow,
            {paddingHorizontal: spacing[4], gap: 2},
          ]}>
          <AppText variant="caption" colour="textSecondary">
            STORIES
          </AppText>
        </View>
      ) : null}

      {/* Open stage — no card / border / fill. */}
      <View
        onLayout={onStageLayout}
        style={[styles.stage, compact ? styles.stageCompact : styles.stageTall]}>
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={ITEM_SLOT}
          decelerationRate="fast"
          contentContainerStyle={{
            paddingHorizontal: sidePad,
            alignItems: 'center',
            minHeight: compact ? 176 : 228,
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

/** Degrees → radians. 0° = 3 o’clock, clockwise (SVG). */
function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  }
}

/**
 * Dial arc path (reference: thick gradient on top-left ~120°).
 * Angles in screen space (0° = east, clockwise). Uses CCW sweep so the
 * short top→left dial is drawn, not the long bottom arc.
 */
function dialArcPath(
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number,
): string {
  const start = polar(cx, cy, r, startDeg)
  const end = polar(cx, cy, r, endDeg)
  // Counterclockwise delta from start → end.
  const ccw = ((startDeg - endDeg + 360) % 360)
  const large = ccw > 180 ? 1 : 0
  // sweep-flag 0 = counterclockwise in SVG
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${large} 0 ${end.x} ${end.y}`
}

function fullRingPath(cx: number, cy: number, r: number): string {
  // Two semicircles so SVG can stroke a closed ring cleanly.
  const left = polar(cx, cy, r, 180)
  const right = polar(cx, cy, r, 0)
  return `M ${right.x} ${right.y} A ${r} ${r} 0 1 1 ${left.x} ${left.y} A ${r} ${r} 0 1 1 ${right.x} ${right.y}`
}

function StoryDial({
  id,
  size,
  mode,
}: {
  id: string
  size: number
  /** `dial` = thick partial arc; `ring` = thin full circle; `idle` = none */
  mode: 'dial' | 'ring' | 'idle'
}) {
  if (mode === 'idle') return null

  const stroke = mode === 'ring' ? 2.25 : 5.5
  const r = (size - stroke) / 2
  const c = size / 2
  const gradientId = `story-grad-${id}`

  // Reference dial: thick arc from just past 12 o'clock through 9 o'clock (~130°).
  const path =
    mode === 'ring'
      ? fullRingPath(c, c, r)
      : dialArcPath(c, c, r, -70, 200)

  return (
    <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
      <Defs>
        <SvgLinearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#FF4D8D" />
          <Stop offset="42%" stopColor="#C45CFF" />
          <Stop offset="78%" stopColor="#4B7BFF" />
          <Stop offset="100%" stopColor="#E8A838" />
        </SvgLinearGradient>
      </Defs>
      <Path
        d={path}
        stroke={`url(#${gradientId})`}
        strokeWidth={stroke}
        fill="none"
        strokeLinecap="round"
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
  const {colours, scheme} = useThemeTokens()
  const isYou = person.id === 'you'
  const size = isYou ? CENTER_SIZE : SIDE_SIZE
  // White gap between avatar and dial (reference).
  const gap = isYou ? 5 : 4
  const avatarSize = size - (isYou ? 18 : 22)
  const ringPulse = useSharedValue(1)

  useEffect(() => {
    if (!person.fresh || reduceMotion || isYou) return
    ringPulse.value = withRepeat(withTiming(1.03, {duration: 1600}), -1, true)
  }, [isYou, person.fresh, reduceMotion, ringPulse])

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [
      {scale: person.fresh && !reduceMotion && !isYou ? ringPulse.value : 1},
    ],
  }))

  const animatedStyle = useAnimatedStyle(() => {
    const center = index * ITEM_SLOT
    const distance = Math.abs(scrollX.value - center)
    const scale = interpolate(
      distance,
      [0, ITEM_SLOT, ITEM_SLOT * 2],
      [1, 0.7, 0.55],
      Extrapolation.CLAMP,
    )
    const opacity = interpolate(
      distance,
      [0, ITEM_SLOT, ITEM_SLOT * 2.2],
      [1, 0.85, 0.5],
      Extrapolation.CLAMP,
    )
    const translateY = interpolate(
      distance,
      [0, ITEM_SLOT, ITEM_SLOT * 2],
      [0, 12, 20],
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
      [0, ITEM_SLOT * 0.5, ITEM_SLOT],
      [0, 0.45, 1],
      Extrapolation.CLAMP,
    )
    return {opacity}
  })

  const addStyle = useAnimatedStyle(() => {
    const distance = Math.abs(scrollX.value - index * ITEM_SLOT)
    const opacity = interpolate(
      distance,
      [0, ITEM_SLOT * 0.35],
      [1, 0],
      Extrapolation.CLAMP,
    )
    const translateY = interpolate(
      distance,
      [0, ITEM_SLOT * 0.35],
      [0, 10],
      Extrapolation.CLAMP,
    )
    return {
      opacity,
      transform: [{translateY}],
    }
  })

  const dialMode: 'dial' | 'ring' | 'idle' = isYou
    ? 'ring'
    : person.fresh
      ? 'dial'
      : 'idle'

  const pillBg = scheme === 'dark' ? colours.surface : '#FFFFFF'
  const plusBg = colours.text

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
            styles.ringHost,
            pulseStyle,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
            },
          ]}>
          <StoryDial id={person.id} size={size} mode={dialMode} />
          <View
            style={[
              styles.avatarWell,
              {
                width: avatarSize + gap * 2,
                height: avatarSize + gap * 2,
                borderRadius: 999,
                backgroundColor: colours.canvas,
                // Soft lift matching reference floating faces.
                shadowColor: '#000',
                shadowOpacity: scheme === 'dark' ? 0.35 : 0.12,
                shadowRadius: 10,
                shadowOffset: {width: 0, height: 4},
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
            <View
              style={[
                styles.addPill,
                {
                  backgroundColor: pillBg,
                  borderColor: colours.border,
                },
              ]}>
              <AppText variant="label" colour="text">
                Add Story
              </AppText>
              <View style={[styles.addPlus, {backgroundColor: plusBg}]}>
                <AppText variant="label" style={styles.addPlusGlyph}>
                  +
                </AppText>
              </View>
            </View>
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
  addPill: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 8,
    paddingLeft: 14,
    paddingRight: 5,
    paddingVertical: 5,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 3},
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  addPlus: {
    alignItems: 'center',
    borderRadius: 12,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  addPlusGlyph: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 17,
  },
  addWrap: {
    justifyContent: 'center',
    minHeight: 34,
  },
  avatarBare: {
    borderWidth: 0,
  },
  avatarWell: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    zIndex: 1,
  },
  captionRow: {},
  name: {
    maxWidth: ITEM_SLOT - 6,
    textAlign: 'center',
  },
  nodePress: {
    alignItems: 'center',
    gap: 10,
    width: ITEM_SLOT,
  },
  ringHost: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  root: {
    marginBottom: 2,
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
    // Intentionally open — no card chrome.
    overflow: 'visible',
  },
  stageCompact: {
    minHeight: 176,
    paddingBottom: 4,
  },
  stageTall: {
    minHeight: 228,
    paddingBottom: 6,
  },
})
