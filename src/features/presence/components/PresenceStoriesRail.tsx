import {useRouter, type Href} from 'expo-router'
import {useLayoutEffect, useMemo, useRef, useState} from 'react'
import {
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native'
import Animated, {
  Extrapolation,
  FadeIn,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
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
import type {PresenceRailPerson} from '@/features/presence/contracts/presenceRail'
import {useReduceMotion} from '@/lib/accessibility'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

/** Slot width = snap distance. Tighter = denser dial. */
const ITEM_SLOT = 76
/** Drawn size at full focus (scale 1) — compact dial. */
const NODE_SIZE = 86
const AVATAR_INSET = 14

type PresenceStoriesRailProps = {
  people?: PresenceRailPerson[]
  compact?: boolean
  showCaption?: boolean
}

const COMPACT_RING = 68
const COMPACT_AVATAR = 56
const COMPACT_SLOT = 76

/**
 * Home Stories — compact flat rail on Home; dial carousel when not compact.
 */
export function PresenceStoriesRail({
  people = [],
  compact = false,
  showCaption = true,
}: PresenceStoriesRailProps) {
  if (people.length === 0) return null

  if (compact) {
    return <CompactStoriesRail people={people} showCaption={showCaption} />
  }

  return <DialStoriesRail people={people} showCaption={showCaption} />
}

function openStory(person: PresenceRailPerson, router: ReturnType<typeof useRouter>) {
  const groupId = person.groupId
  if (
    !groupId ||
    groupId.startsWith('add:') ||
    (person.isOwner && (person.itemCount ?? 0) === 0)
  ) {
    router.push('/stories/create' as Href)
    return
  }
  router.push(`/stories/${encodeURIComponent(groupId)}` as Href)
}

function CompactStoriesRail({
  people,
  showCaption,
}: {
  people: PresenceRailPerson[]
  showCaption: boolean
}) {
  const {colours, spacing, scheme} = useThemeTokens()
  const reduceMotion = useReduceMotion()
  const router = useRouter()

  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeIn.duration(180)}
      style={[styles.compactRoot, {gap: spacing[2]}]}>
      {showCaption ? (
        <View style={{paddingHorizontal: spacing[4]}}>
          <AppText variant="caption" colour="textSecondary">
            STORIES
          </AppText>
        </View>
      ) : null}
      <Animated.ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: spacing[4],
          gap: spacing[3],
          alignItems: 'flex-start',
        }}>
        {people.map(person => {
          const isYou = person.id === 'you' || person.isOwner
          const isAdd =
            isYou &&
            (!person.groupId ||
              person.groupId.startsWith('add:') ||
              (person.itemCount ?? 0) === 0)
          const showRing =
            person.ringState === 'unviewed' ||
            person.ringState === 'partial' ||
            person.fresh ||
            (isYou && !isAdd)
          const viewed =
            person.ringState === 'viewed' || (!person.fresh && !isYou && !isAdd)

          return (
            <Pressable
              key={person.id}
              accessibilityRole="button"
              accessibilityLabel={
                isAdd
                  ? 'Add Story'
                  : `${person.name}. ${
                      person.fresh || person.ringState === 'unviewed'
                        ? 'Unread story'
                        : 'Open story'
                    }`
              }
              onPress={() => openStory(person, router)}
              style={[styles.compactSlot, {width: COMPACT_SLOT}]}>
              <View
                style={[
                  styles.compactRing,
                  {
                    width: COMPACT_RING,
                    height: COMPACT_RING,
                    borderRadius: COMPACT_RING / 2,
                    backgroundColor: colours.canvas,
                  },
                ]}>
                {showRing && !viewed ? (
                  <StoryDial id={`${person.id}-c`} size={COMPACT_RING} mode="ring" />
                ) : (
                  <View
                    style={[
                      StyleSheet.absoluteFill,
                      {
                        borderRadius: COMPACT_RING / 2,
                        borderWidth: 2,
                        borderColor: isAdd
                          ? colours.border
                          : viewed
                            ? colours.border
                            : colours.accent,
                      },
                    ]}
                  />
                )}
                <View
                  style={{
                    width: COMPACT_AVATAR,
                    height: COMPACT_AVATAR,
                    borderRadius: COMPACT_AVATAR / 2,
                    overflow: 'hidden',
                    backgroundColor: colours.surface,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <Avatar
                    name={person.name}
                    uri={person.uri}
                    size={COMPACT_AVATAR}
                    colour={person.colour}
                    style={styles.avatarBare}
                  />
                </View>
                {isAdd || isYou ? (
                  <View
                    style={[
                      styles.compactPlus,
                      {
                        backgroundColor: colours.accent,
                        borderColor: colours.canvas,
                      },
                    ]}>
                    <AppText
                      variant="caption"
                      style={{
                        color: colours.accentForeground,
                        fontWeight: '700',
                        fontSize: 14,
                        lineHeight: 16,
                      }}>
                      +
                    </AppText>
                  </View>
                ) : null}
              </View>
              <AppText
                variant="caption"
                colour="text"
                numberOfLines={1}
                style={[
                  styles.compactName,
                  {color: scheme === 'dark' ? colours.text : colours.text},
                ]}>
                {isAdd ? 'Your story' : person.name}
              </AppText>
            </Pressable>
          )
        })}
      </Animated.ScrollView>
    </Animated.View>
  )
}

function DialStoriesRail({
  people,
  showCaption,
}: {
  people: PresenceRailPerson[]
  showCaption: boolean
}) {
  const {spacing} = useThemeTokens()
  const reduceMotion = useReduceMotion()
  const router = useRouter()
  const [stageWidth, setStageWidth] = useState(0)
  const scrollRef = useRef<Animated.ScrollView>(null)
  const scrollX = useSharedValue(0)
  const ready = stageWidth > 0

  // Nudge right so the Add Story pill isn’t clipped off the left edge.
  const padLeft = ready ? Math.max(spacing[4], 28) : 0
  const padRight = ready
    ? Math.max(0, stageWidth - padLeft - ITEM_SLOT)
    : 0
  const snapOffsets = useMemo(
    () => people.map((_, index) => index * ITEM_SLOT),
    [people],
  )

  const onScroll = useAnimatedScrollHandler({
    onScroll: event => {
      scrollX.value = Math.max(0, event.contentOffset.x)
    },
  })

  const onStageLayout = (event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.width)
    if (next > 0 && next !== stageWidth) {
      setStageWidth(next)
    }
  }

  useLayoutEffect(() => {
    if (!ready) return
    scrollX.value = 0
    scrollRef.current?.scrollTo({x: 0, y: 0, animated: false})
  }, [ready, padLeft, scrollX])

  const snapToIndex = (index: number, animated: boolean) => {
    scrollRef.current?.scrollTo({
      x: Math.max(0, index * ITEM_SLOT),
      animated,
    })
  }

  const stageHeight = 196

  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeIn.duration(180)}
      style={[styles.root, {gap: spacing[1]}]}>
      {showCaption ? (
        <View
          style={[
            styles.captionRow,
            {paddingHorizontal: Math.max(spacing[4], 28), gap: 2},
          ]}>
          <AppText variant="caption" colour="textSecondary">
            STORIES
          </AppText>
        </View>
      ) : null}

      <View
        onLayout={onStageLayout}
        style={[styles.stage, {minHeight: stageHeight}]}>
        {ready ? (
          <Animated.ScrollView
            ref={scrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToOffsets={snapOffsets}
            snapToAlignment="start"
            disableIntervalMomentum
            decelerationRate={0.88}
            bounces
            alwaysBounceHorizontal={false}
            contentContainerStyle={{
              paddingLeft: padLeft,
              paddingRight: padRight,
              paddingTop: 6,
              alignItems: 'flex-start',
              minHeight: stageHeight,
            }}
            onScroll={onScroll}
            scrollEventThrottle={1}>
            {people.map((person, index) => (
              <StoryNode
                key={person.id}
                person={person}
                index={index}
                scrollX={scrollX}
                reduceMotion={reduceMotion}
                onPress={() => {
                  snapToIndex(index, !reduceMotion)
                  openStory(person, router)
                }}
              />
            ))}
          </Animated.ScrollView>
        ) : (
          <View style={{height: stageHeight}} />
        )}
      </View>
    </Animated.View>
  )
}

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  }
}

function dialArcPath(
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number,
): string {
  const start = polar(cx, cy, r, startDeg)
  const end = polar(cx, cy, r, endDeg)
  const ccw = (startDeg - endDeg + 360) % 360
  const large = ccw > 180 ? 1 : 0
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${large} 0 ${end.x} ${end.y}`
}

function fullRingPath(cx: number, cy: number, r: number): string {
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
  mode: 'dial' | 'ring' | 'idle'
}) {
  if (mode === 'idle') return null

  const stroke = mode === 'ring' ? 2 : 4.25
  const r = (size - stroke) / 2
  const c = size / 2
  const gradientId = `story-grad-${id}`
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
  const avatarSize = NODE_SIZE - AVATAR_INSET
  const gap = 3

  const animatedStyle = useAnimatedStyle(() => {
    const offset = scrollX.value - index * ITEM_SLOT
    const distance = Math.abs(offset)
    // Compact dial: center pops, sides drop hard along an arch.
    const scale = interpolate(
      distance,
      [0, ITEM_SLOT * 0.5, ITEM_SLOT, ITEM_SLOT * 2],
      [1, 0.78, 0.62, 0.48],
      Extrapolation.CLAMP,
    )
    const opacity = interpolate(
      distance,
      [0, ITEM_SLOT, ITEM_SLOT * 2],
      [1, 0.82, 0.48],
      Extrapolation.CLAMP,
    )
    // Downward arch — further from center = lower on the dial.
    const translateY = reduceMotion
      ? 0
      : interpolate(
          distance,
          [0, ITEM_SLOT, ITEM_SLOT * 2, ITEM_SLOT * 3],
          [0, 22, 40, 52],
          Extrapolation.CLAMP,
        )
    const rotate = reduceMotion
      ? '0deg'
      : `${interpolate(
          offset,
          [-ITEM_SLOT * 2, -ITEM_SLOT, 0, ITEM_SLOT, ITEM_SLOT * 2],
          [22, 12, 0, -12, -22],
          Extrapolation.CLAMP,
        )}deg`
    const zIndex = Math.round(
      interpolate(distance, [0, ITEM_SLOT], [40, 4], Extrapolation.CLAMP),
    )

    return {
      zIndex,
      opacity,
      transform: [{translateY}, {scale}, {rotate}],
    }
  })

  const labelStyle = useAnimatedStyle(() => {
    const distance = Math.abs(scrollX.value - index * ITEM_SLOT)
    // Keep the focused name fully readable; only fade far neighbours.
    return {
      opacity: interpolate(
        distance,
        [0, ITEM_SLOT * 0.55, ITEM_SLOT * 1.4],
        [1, 0.9, 0.45],
        Extrapolation.CLAMP,
      ),
    }
  })

  const addStyle = useAnimatedStyle(() => {
    const distance = Math.abs(scrollX.value - index * ITEM_SLOT)
    // Add Story only when *this* (you) node is focused.
    return {
      opacity: interpolate(
        distance,
        [0, ITEM_SLOT * 0.4],
        [1, 0],
        Extrapolation.CLAMP,
      ),
      transform: [
        {
          translateY: interpolate(
            distance,
            [0, ITEM_SLOT * 0.4],
            [0, 12],
            Extrapolation.CLAMP,
          ),
        },
        {
          scale: interpolate(
            distance,
            [0, ITEM_SLOT * 0.4],
            [1, 0.85],
            Extrapolation.CLAMP,
          ),
        },
      ],
    }
  })

  // Chrome: focused → thin full ring; side + unread → dial arc.
  // Approximate with static modes from person; animated ring swap is heavy —
  // use dial for fresh sides, ring for everyone when we'd need focus... 
  // Simpler: always draw dial for fresh, ring for you; focus scale does the rest.
  // Better UX: both ring when centered — use two layers with animated opacity.
  const dialSideStyle = useAnimatedStyle(() => {
    const distance = Math.abs(scrollX.value - index * ITEM_SLOT)
    const focused = distance < ITEM_SLOT * 0.45
    if (!person.fresh && !isYou) return {opacity: 0}
    // Side dial visible when not focused.
    return {opacity: focused ? 0 : person.fresh || isYou ? 1 : 0}
  })

  const ringFocusStyle = useAnimatedStyle(() => {
    const distance = Math.abs(scrollX.value - index * ITEM_SLOT)
    const focused = distance < ITEM_SLOT * 0.45
    if (!person.fresh && !isYou) return {opacity: 0}
    return {opacity: focused ? 1 : 0}
  })

  const pillBg = scheme === 'dark' ? colours.surface : '#FFFFFF'
  const plusBg = colours.text

  return (
    <Animated.View style={[styles.slot, animatedStyle]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          isYou
            ? 'Your story. Add Story.'
            : `${person.name}. ${person.fresh ? 'Unread story.' : 'Open story.'}`
        }
        onPress={onPress}
        style={styles.nodePress}>
        <View
          style={[
            styles.ringHost,
            {width: NODE_SIZE, height: NODE_SIZE, borderRadius: NODE_SIZE / 2},
          ]}>
          <Animated.View style={[StyleSheet.absoluteFill, dialSideStyle]}>
            <StoryDial id={`${person.id}-dial`} size={NODE_SIZE} mode="dial" />
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, ringFocusStyle]}>
            <StoryDial id={`${person.id}-ring`} size={NODE_SIZE} mode="ring" />
          </Animated.View>

          <View
            style={[
              styles.avatarWell,
              {
                width: avatarSize + gap * 2,
                height: avatarSize + gap * 2,
                borderRadius: 999,
                backgroundColor: colours.canvas,
                shadowColor: '#000',
                shadowOpacity: scheme === 'dark' ? 0.35 : 0.14,
                shadowRadius: 12,
                shadowOffset: {width: 0, height: 5},
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
        </View>

        {isYou ? (
          <Animated.View style={[styles.addWrap, addStyle]} pointerEvents="none">
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
              colour="text"
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
  compactName: {
    maxWidth: COMPACT_SLOT,
    textAlign: 'center',
  },
  compactPlus: {
    alignItems: 'center',
    borderRadius: 11,
    borderWidth: 2,
    bottom: 0,
    height: 22,
    justifyContent: 'center',
    position: 'absolute',
    right: 0,
    width: 22,
  },
  compactRing: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactRoot: {
    marginBottom: 4,
    width: '100%',
  },
  compactSlot: {
    alignItems: 'center',
    gap: 6,
  },
  addPill: {
    alignItems: 'center',
    alignSelf: 'center',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 10,
    minWidth: 128,
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 3},
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  addPlus: {
    alignItems: 'center',
    borderRadius: 13,
    height: 26,
    justifyContent: 'center',
    width: 26,
  },
  addPlusGlyph: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 18,
  },
  addWrap: {
    justifyContent: 'center',
    minHeight: 36,
    minWidth: 128,
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
    overflow: 'visible',
    width: ITEM_SLOT,
  },
  ringHost: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  root: {
    marginBottom: 2,
    overflow: 'visible',
  },
  rootCompact: {
    marginBottom: 0,
  },
  slot: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
    width: ITEM_SLOT,
  },
  stage: {
    overflow: 'visible',
  },
})
