import {useState} from 'react'
import {StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'

import {AppIcon} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {
  INSPIRE_DESTINATIONS,
  type InspireDestination,
} from '@/features/discover/data/inspireSeed'
import {useReduceMotion} from '@/lib/accessibility'
import {selectionHaptic} from '@/lib/haptics'
import {SectionEnter} from '@/platform/ui/motion/section-enter'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type InspireNextListProps = {
  limit?: number
  showSeeAll?: boolean
}

/** Vertical inspire list — communities/topics with wishlist-style save preview. */
export function InspireNextList({limit = 4, showSeeAll = true}: InspireNextListProps) {
  const router = useRouter()
  const {colours, spacing} = useThemeTokens()
  const items = INSPIRE_DESTINATIONS.slice(0, limit)

  return (
    <SectionEnter delay={140}>
      <View style={{gap: spacing[3]}}>
        <View style={styles.header}>
          <AppText variant="headline">Inspire next</AppText>
          {showSeeAll ? (
            <AppPressable
              accessibilityLabel="See all inspire destinations"
              onPress={() => {
                void selectionHaptic()
                router.push('/discover/inspire' as Href)
              }}
              style={styles.seeAll}>
              <AppText variant="label" colour="accent">
                See all
              </AppText>
              <AppIcon name="chevronRight" colour={colours.accent} size={16} />
            </AppPressable>
          ) : null}
        </View>
        <View style={{gap: spacing[2]}}>
          {items.map((item, index) => (
            <InspireRow key={item.id} item={item} index={index} />
          ))}
        </View>
      </View>
    </SectionEnter>
  )
}

function InspireRow({item, index}: {item: InspireDestination; index: number}) {
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()
  const reduceMotion = useReduceMotion()
  const heartScale = useSharedValue(1)
  const [saved, setSaved] = useState(false)

  const heartStyle = useAnimatedStyle(() => ({
    transform: [{scale: heartScale.value}],
  }))

  return (
    <SectionEnter delay={160 + index * 36}>
      <AppPressable
        accessibilityLabel={`Open ${item.title}`}
        onPress={() => {
          void selectionHaptic()
          router.push(item.href as Href)
        }}
        style={[
          styles.row,
          {
            backgroundColor: colours.surfaceRaised,
            borderColor: colours.border,
            borderRadius: radius.xlarge,
            gap: spacing[3],
            padding: spacing[3],
          },
        ]}>
        <View
          style={[
            styles.thumb,
            {backgroundColor: item.colour, borderRadius: radius.large},
          ]}
        />
        <View style={styles.body}>
          <AppText variant="label">{item.title}</AppText>
          <AppText variant="caption" colour="textSecondary">
            {item.subtitle}
          </AppText>
          {item.highlights.map(line => (
            <AppText key={line} variant="caption" colour="textTertiary" numberOfLines={1}>
              · {line}
            </AppText>
          ))}
        </View>
        <AppPressable
          accessibilityLabel={saved ? `Unsave ${item.title}` : `Save ${item.title}`}
          accessibilityState={{selected: saved}}
          onPress={() => {
            void selectionHaptic()
            setSaved(prev => !prev)
            if (!reduceMotion) {
              // Reanimated shared value, not React state.
              // eslint-disable-next-line react-hooks/immutability
              heartScale.value = withSpring(1.25, {damping: 10, stiffness: 280}, () => {
                heartScale.value = withSpring(1, {damping: 14, stiffness: 220})
              })
            }
          }}
          style={styles.heartHit}>
          <Animated.View style={heartStyle}>
            <AppIcon
              name="bookmark"
              colour={saved ? colours.accent : colours.textTertiary}
              size={20}
            />
          </Animated.View>
        </AppPressable>
      </AppPressable>
    </SectionEnter>
  )
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heartHit: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  row: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
  },
  seeAll: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 2,
    minHeight: 44,
  },
  thumb: {
    height: 56,
    width: 56,
  },
})
