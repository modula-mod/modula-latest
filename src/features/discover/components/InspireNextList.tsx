import {useState} from 'react'
import {StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {
  INSPIRE_DESTINATIONS,
  type InspireDestination,
} from '@/features/discover/data/inspireSeed'
import {useReduceMotion} from '@/lib/accessibility'
import {selectionHaptic} from '@/lib/haptics'
import {SectionEnter} from '@/platform/ui/motion/section-enter'
import {ModulaIcon} from '@/platform/ui/icons'
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
              <ModulaIcon name="chevronRight" colour={colours.accent} size={16} />
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
      <View
        style={[
          styles.row,
          {
            borderBottomColor: colours.separator,
            gap: spacing[3],
            paddingVertical: spacing[2],
          },
        ]}>
        <AppPressable
          accessibilityLabel={`Open ${item.title}`}
          onPress={() => {
            void selectionHaptic()
            router.push(item.href as Href)
          }}
          style={[styles.identity, {gap: spacing[3]}]}>
          <View
            style={[
              styles.thumb,
              {backgroundColor: item.colour, borderRadius: radius.medium},
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
        </AppPressable>
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
            <ModulaIcon
              name="bookmark"
              colour={saved ? colours.accent : colours.textTertiary}
              size={20}
            />
          </Animated.View>
        </AppPressable>
      </View>
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
  identity: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    minWidth: 0,
  },
  row: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
  },
  seeAll: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 2,
    minHeight: 44,
  },
  thumb: {
    height: 48,
    width: 48,
  },
})
