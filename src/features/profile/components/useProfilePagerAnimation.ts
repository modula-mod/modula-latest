/* eslint-disable react-hooks/immutability */
import {useCallback, useEffect, useMemo, useState} from 'react'
import {Gesture} from 'react-native-gesture-handler'
import {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'

import {useReduceMotion} from '@/lib/accessibility'
import {selectionHaptic} from '@/lib/haptics'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const AXIS_LOCK = 10

export function useProfilePagerAnimation(pageCount: number) {
  const {motion} = useThemeTokens()
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
      const clamped = Math.max(0, Math.min(pageCount - 1, next))
      if (clamped !== pageIndex) {
        void selectionHaptic()
        setPageIndex(clamped)
      }
      pageSV.value = clamped
    },
    [pageCount, pageIndex, pageSV],
  )

  const animateTo = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(pageCount - 1, next))
      const destination = -clamped * pageWidth
      if (reduceMotion) {
        translateX.value = withTiming(destination, {duration: motion.fast || 120})
      } else {
        translateX.value = withSpring(destination, motion.springs.selection)
      }
      commitPage(clamped)
    },
    [
      commitPage,
      motion.fast,
      motion.springs.selection,
      pageCount,
      pageWidth,
      reduceMotion,
      translateX,
    ],
  )

  const createPan = useCallback(() => {
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
        const min = -(pageCount - 1) * width
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
        const next = Math.max(0, Math.min(pageCount - 1, unbounded))
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
    pageCount,
    pageSV,
    reduceMotion,
    startX,
    translateX,
    widthSV,
  ])

  const pan = useMemo(() => createPan(), [createPan])

  const trackStyle = useAnimatedStyle(() => ({
    transform: [{translateX: translateX.value}],
  }))

  const goTo = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(pageCount - 1, next))
      if (pageWidth > 0) {
        animateTo(clamped)
        return
      }
      pageSV.value = clamped
      commitPage(clamped)
    },
    [animateTo, commitPage, pageCount, pageSV, pageWidth],
  )

  const onViewportLayout = useCallback(
    (width: number) => {
      const next = Math.round(width)
      if (next > 0 && next !== pageWidth) {
        setPageWidth(next)
        translateX.value = -pageSV.value * next
      }
    },
    [pageSV, pageWidth, translateX],
  )

  return {
    pageIndex,
    pageWidth,
    pan,
    createPan,
    trackStyle,
    goTo,
    onViewportLayout,
    reduceMotion,
  }
}
