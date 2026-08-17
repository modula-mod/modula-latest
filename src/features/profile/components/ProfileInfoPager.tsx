/* eslint-disable react-hooks/immutability */
import {useCallback, useEffect, useMemo, useState, type ReactNode} from 'react'
import {Pressable, StyleSheet, View} from 'react-native'
import {Gesture, GestureDetector} from 'react-native-gesture-handler'
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'

import {useReduceMotion} from '@/lib/accessibility'
import {selectionHaptic} from '@/lib/haptics'
import {PROFILE_LAYOUT} from '@/features/profile/model/profile-layout'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type ProfileInfoPage = 'metrics' | 'about'

const PAGES: ProfileInfoPage[] = ['metrics', 'about']
const AXIS_LOCK = 10
const PAGE_COUNT = PAGES.length

type ProfileInfoPagerProps = {
  metrics: ReactNode
  about: ReactNode
}

/**
 * Compact two-page hero pager. Metrics first, About second.
 *
 * Pager About is a compact identity summary. The top-level Profile About tab
 * remains the full expanded profile information. Do not sync their state.
 */
export function ProfileInfoPager({metrics, about}: ProfileInfoPagerProps) {
  const {colours, motion} = useThemeTokens()
  const reduceMotion = useReduceMotion()
  const [pageWidth, setPageWidth] = useState(0)
  const [pageIndex, setPageIndex] = useState(0)
  const translateX = useSharedValue(0)
  const startX = useSharedValue(0)
  const widthSV = useSharedValue(0)
  const pageSV = useSharedValue(0)

  useEffect(() => {
    widthSV.value = pageWidth
  }, [pageWidth, widthSV])

  const commitPage = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(PAGE_COUNT - 1, next))
      if (clamped !== pageIndex) {
        void selectionHaptic()
        setPageIndex(clamped)
      }
      pageSV.value = clamped
    },
    [pageIndex, pageSV],
  )

  const animateTo = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(PAGE_COUNT - 1, next))
      const destination = -clamped * pageWidth
      if (reduceMotion) {
        translateX.value = withTiming(destination, {duration: motion.fast || 120})
      } else {
        translateX.value = withSpring(destination, motion.springs.selection)
      }
      commitPage(clamped)
    },
    [commitPage, motion.fast, motion.springs.selection, pageWidth, reduceMotion, translateX],
  )

  const pan = useMemo(() => {
    return Gesture.Pan()
      .maxPointers(1)
      .activeOffsetX([-AXIS_LOCK, AXIS_LOCK])
      .failOffsetY([-AXIS_LOCK, AXIS_LOCK])
      .onBegin(() => {
        startX.value = translateX.value
      })
      .onUpdate(event => {
        const width = widthSV.value
        if (width <= 0) return
        const min = -(PAGE_COUNT - 1) * width
        const raw = startX.value + event.translationX
        if (raw > 0) {
          translateX.value = raw * 0.28
        } else if (raw < min) {
          translateX.value = min + (raw - min) * 0.28
        } else {
          translateX.value = raw
        }
      })
      .onEnd(event => {
        const width = widthSV.value
        if (width <= 0) return
        const from = pageSV.value
        const projected = translateX.value + event.velocityX * 0.12
        const unbounded = Math.round(-projected / width)
        const next = Math.max(0, Math.min(PAGE_COUNT - 1, unbounded))
        const destination = -next * width
        if (reduceMotion) {
          translateX.value = withTiming(destination, {duration: 120})
        } else {
          translateX.value = withSpring(destination, motion.springs.selection)
        }
        if (next !== from) {
          runOnJS(commitPage)(next)
        } else {
          pageSV.value = next
        }
      })
  }, [
    commitPage,
    motion.springs.selection,
    pageSV,
    reduceMotion,
    startX,
    translateX,
    widthSV,
  ])

  const trackStyle = useAnimatedStyle(() => ({
    transform: [{translateX: translateX.value}],
  }))

  const goTo = (next: number) => {
    const clamped = Math.max(0, Math.min(PAGE_COUNT - 1, next))
    const width = pageWidth
    if (width > 0) {
      animateTo(clamped)
      return
    }
    pageSV.value = clamped
    commitPage(clamped)
  }

  const current = PAGES[pageIndex] ?? 'metrics'
  const accessibilityValue =
    current === 'metrics'
      ? 'Metrics. Page 1 of 2.'
      : 'About. Page 2 of 2.'

  return (
    <View
      testID="profile-info-pager"
      style={styles.host}
      onLayout={event => {
        const next = Math.round(event.nativeEvent.layout.width)
        if (next > 0 && next !== pageWidth) {
          setPageWidth(next)
          translateX.value = -pageSV.value * next
        }
      }}>
      <View
        accessibilityRole="adjustable"
        accessibilityLabel="Profile details"
        accessibilityValue={{text: accessibilityValue}}
        accessibilityHint="Swipe left or right to change page."
        accessibilityActions={[
          {name: 'increment', label: 'Next page'},
          {name: 'decrement', label: 'Previous page'},
        ]}
        onAccessibilityAction={event => {
          const name = event.nativeEvent.actionName
          if (name === 'increment') goTo(1)
          if (name === 'decrement') goTo(0)
        }}
        style={styles.a11yAnchor}
      />
      <GestureDetector gesture={pan}>
        <View style={[styles.viewport, {minHeight: PROFILE_LAYOUT.pagerMinHeight, maxHeight: PROFILE_LAYOUT.pagerMaxHeight}]}>
          <Animated.View
            style={[
              styles.track,
              {width: pageWidth > 0 ? pageWidth * PAGE_COUNT : '200%'},
              trackStyle,
            ]}>
            <View
              testID="profile-info-page-metrics"
              accessibilityElementsHidden={pageIndex !== 0}
              importantForAccessibility={pageIndex === 0 ? 'auto' : 'no-hide-descendants'}
              style={[styles.page, pageWidth > 0 ? {width: pageWidth} : styles.pageHalf]}>
              {metrics}
            </View>
            <View
              testID="profile-info-page-about"
              accessibilityElementsHidden={pageIndex !== 1}
              importantForAccessibility={pageIndex === 1 ? 'auto' : 'no-hide-descendants'}
              style={[styles.page, pageWidth > 0 ? {width: pageWidth} : styles.pageHalf]}>
              {about}
            </View>
          </Animated.View>
        </View>
      </GestureDetector>
      <View style={styles.indicators} testID="profile-info-pager-indicators">
        {PAGES.map((id, index) => {
          const active = index === pageIndex
          return (
            <Pressable
              key={id}
              accessibilityRole="button"
              accessibilityLabel={index === 0 ? 'Metrics page' : 'About page'}
              accessibilityState={{selected: active}}
              testID={`profile-info-indicator-${id}`}
              hitSlop={12}
              onPress={() => goTo(index)}
              style={styles.indicatorHit}>
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor: active ? colours.accent : colours.textTertiary,
                    opacity: active ? 1 : 0.38,
                    width: PROFILE_LAYOUT.pagerIndicatorSize,
                    height: PROFILE_LAYOUT.pagerIndicatorSize,
                    borderRadius: PROFILE_LAYOUT.pagerIndicatorSize / 2,
                  },
                ]}
              />
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  host: {
    minWidth: 0,
    width: '100%',
  },
  a11yAnchor: {
    height: 1,
    overflow: 'hidden',
    width: 1,
  },
  viewport: {
    overflow: 'hidden',
    width: '100%',
  },
  track: {
    flexDirection: 'row',
  },
  page: {
    minWidth: 0,
  },
  pageHalf: {
    width: '50%',
  },
  indicators: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    minHeight: 20,
    paddingTop: 4,
  },
  indicatorHit: {
    alignItems: 'center',
    height: 20,
    justifyContent: 'center',
    width: 20,
  },
  dot: {
    overflow: 'hidden',
  },
})
