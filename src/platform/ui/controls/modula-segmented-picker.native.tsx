import {SegmentedControl as ExpoSegmentedControl} from '@expo/ui/community/segmented-control'
import SegmentedControl from '@react-native-segmented-control/segmented-control'
import {LinearGradient} from 'expo-linear-gradient'
import {useCallback, useEffect, useMemo, useState} from 'react'
import {
  Animated,
  PanResponder,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native'

import {ModulaSegmentedPicker as SharedModulaSegmentedPicker} from '@/platform/ui/controls/modula-segmented-picker.shared'
import type {ModulaSegmentedPickerProps} from '@/platform/ui/controls/modula-segmented-picker.types'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type {ModulaSegmentedOption} from '@/platform/ui/controls/modula-segmented-picker.types'

const DEFAULT_SCROLL_SEGMENT_MIN_WIDTH = 108
const NATIVE_SEGMENTED_HEIGHT = 34
const EDGE_FADE_WIDTH = 14
const SWIPE_THRESHOLD_PX = 28

type ScrollableNativeSegmentedProps = {
  options: ModulaSegmentedPickerProps['options']
  value: string
  onValueChange: (value: string) => void
  accessibilityLabel?: string
  style?: StyleProp<ViewStyle>
  testID?: string
  segmentMinWidth: number
  viewportWidth: number
  edgeFadeColor: string
}

function clampOffset(offset: number, maxOffset: number) {
  return Math.min(maxOffset, Math.max(0, offset))
}

function centeredOffset(
  selectedIndex: number,
  segmentMinWidth: number,
  viewportWidth: number,
  maxOffset: number,
) {
  const selectedOffset = selectedIndex * segmentMinWidth
  const centered = selectedOffset - (viewportWidth - segmentMinWidth) / 2
  return clampOffset(centered, maxOffset)
}

function snapOffset(offset: number, segmentMinWidth: number, maxOffset: number) {
  const snapped = Math.round(offset / segmentMinWidth) * segmentMinWidth
  return clampOffset(snapped, maxOffset)
}

/**
 * Scrollable UISegmentedControl — UIKit, translated inside a clipped viewport.
 *
 * Horizontal ScrollView compositing lets segment labels bleed at the edges.
 * Sliding the whole native control with translateX + overflow:hidden keeps
 * the native look without ghost text while scrolling.
 */
function ScrollableNativeSegmentedControl({
  options,
  value,
  onValueChange,
  accessibilityLabel,
  style,
  testID,
  segmentMinWidth,
  viewportWidth,
  edgeFadeColor,
}: ScrollableNativeSegmentedProps) {
  const {colours, scheme} = useThemeTokens()
  const values = useMemo(() => options.map(option => option.label), [options])
  const selectedIndex = Math.max(
    0,
    options.findIndex(option => option.value === value),
  )
  const enabled = options.every(option => !option.disabled)
  const contentWidth = Math.max(viewportWidth, options.length * segmentMinWidth)
  const maxOffset = Math.max(0, contentWidth - viewportWidth)
  const [translateX] = useState(() => new Animated.Value(0))

  const animateTo = useCallback(
    (offset: number, animated = true) => {
      const next = snapOffset(offset, segmentMinWidth, maxOffset)
      if (animated) {
        Animated.spring(translateX, {
          toValue: -next,
          damping: 24,
          stiffness: 280,
          mass: 0.7,
          useNativeDriver: true,
        }).start()
        return
      }
      translateX.setValue(-next)
    },
    [maxOffset, segmentMinWidth, translateX],
  )

  useEffect(() => {
    animateTo(centeredOffset(selectedIndex, segmentMinWidth, viewportWidth, maxOffset))
  }, [animateTo, maxOffset, segmentMinWidth, selectedIndex, viewportWidth])

  const panResponder = useMemo(() => {
    let dragOrigin = 0
    return PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) =>
          maxOffset > 0 &&
          Math.abs(gesture.dx) > Math.abs(gesture.dy) &&
          Math.abs(gesture.dx) > 6,
        onPanResponderGrant: () => {
          translateX.stopAnimation(value => {
            dragOrigin = -value
          })
        },
        onPanResponderMove: (_event, gesture) => {
          const next = clampOffset(dragOrigin - gesture.dx, maxOffset)
          translateX.setValue(-next)
        },
        onPanResponderRelease: (_event, gesture) => {
          const projected = clampOffset(dragOrigin - gesture.dx, maxOffset)
          if (Math.abs(gesture.dx) >= SWIPE_THRESHOLD_PX || Math.abs(gesture.vx) > 0.35) {
            const direction = gesture.dx + gesture.vx * 40
            const page = snapOffset(
              direction < 0
                ? projected + segmentMinWidth * 0.5
                : projected - segmentMinWidth * 0.5,
              segmentMinWidth,
              maxOffset,
            )
            animateTo(page)
            return
          }
          animateTo(projected)
        },
      })
  }, [animateTo, maxOffset, segmentMinWidth, translateX])

  if (contentWidth <= viewportWidth) {
    return (
      <SegmentedControl
        values={values}
        selectedIndex={selectedIndex}
        enabled={enabled}
        appearance={scheme === 'dark' ? 'dark' : 'light'}
        tintColor={colours.accent}
        style={[
          {
            alignSelf: 'stretch',
            height: NATIVE_SEGMENTED_HEIGHT,
            width: viewportWidth,
          },
          style,
        ]}
        testID={testID ?? accessibilityLabel}
        onValueChange={label => {
          const match = options.find(option => option.label === label)
          if (match && !match.disabled) {
            onValueChange(match.value)
          }
        }}
      />
    )
  }

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      style={[{alignSelf: 'center', width: viewportWidth}, style]}>
      <View
        style={{height: NATIVE_SEGMENTED_HEIGHT, overflow: 'hidden', width: viewportWidth}}
        {...panResponder.panHandlers}>
        <Animated.View style={{transform: [{translateX}]}}>
          <SegmentedControl
            values={values}
            selectedIndex={selectedIndex}
            enabled={enabled}
            appearance={scheme === 'dark' ? 'dark' : 'light'}
            tintColor={colours.accent}
            style={{
              height: NATIVE_SEGMENTED_HEIGHT,
              width: contentWidth,
            }}
            testID={testID ? `${testID}-native` : accessibilityLabel}
            onValueChange={label => {
              const match = options.find(option => option.label === label)
              if (match && !match.disabled) {
                onValueChange(match.value)
              }
            }}
          />
        </Animated.View>
      </View>
      {maxOffset > 0 ? (
        <>
          <LinearGradient
            colors={[edgeFadeColor, `${edgeFadeColor}00`]}
            end={{x: 1, y: 0.5}}
            pointerEvents="none"
            start={{x: 0, y: 0.5}}
            style={{
              bottom: 0,
              left: 0,
              position: 'absolute',
              top: 0,
              width: EDGE_FADE_WIDTH,
            }}
          />
          <LinearGradient
            colors={[`${edgeFadeColor}00`, edgeFadeColor]}
            end={{x: 1, y: 0.5}}
            pointerEvents="none"
            start={{x: 0, y: 0.5}}
            style={{
              bottom: 0,
              position: 'absolute',
              right: 0,
              top: 0,
              width: EDGE_FADE_WIDTH,
            }}
          />
        </>
      ) : null}
    </View>
  )
}

/**
 * Native adapter:
 * - `segmented` — `@expo/ui/community/segmented-control` (SwiftUI segmented Picker)
 * - `segmented` + `scrollable` — UIKit UISegmentedControl, clipped translate scroll
 * - `glass` / `plain` / `track` / sticky overlays — shared RN implementation
 */
export function ModulaSegmentedPicker({
  options,
  value,
  onValueChange,
  accessibilityLabel,
  style,
  testID,
  appearance = 'segmented',
  scrollable = false,
  segmentMinWidth,
  maxWidth,
  embedded,
}: ModulaSegmentedPickerProps) {
  const {colours, scheme} = useThemeTokens()
  const {width: windowWidth} = useWindowDimensions()
  const viewportWidth = Math.min(windowWidth - 32, maxWidth ?? windowWidth)
  const values = useMemo(() => options.map(option => option.label), [options])
  const selectedIndex = Math.max(
    0,
    options.findIndex(option => option.value === value),
  )
  const enabled = options.every(option => !option.disabled)
  const resolvedSegmentMinWidth = segmentMinWidth ?? DEFAULT_SCROLL_SEGMENT_MIN_WIDTH

  if (scrollable && appearance === 'segmented') {
    return (
      <ScrollableNativeSegmentedControl
        edgeFadeColor={colours.surface}
        options={options}
        value={value}
        onValueChange={onValueChange}
        accessibilityLabel={accessibilityLabel}
        style={style}
        testID={testID}
        segmentMinWidth={resolvedSegmentMinWidth}
        viewportWidth={viewportWidth}
      />
    )
  }

  if (appearance !== 'segmented' || embedded) {
    return (
      <SharedModulaSegmentedPicker
        options={options}
        value={value}
        onValueChange={onValueChange}
        accessibilityLabel={accessibilityLabel}
        style={style}
        testID={testID}
        appearance={appearance === 'segmented' ? 'track' : appearance}
        scrollable={scrollable}
        segmentMinWidth={segmentMinWidth}
        maxWidth={maxWidth}
        embedded={embedded}
      />
    )
  }

  return (
    <ExpoSegmentedControl
      values={values}
      selectedIndex={selectedIndex}
      enabled={enabled}
      appearance={scheme === 'dark' ? 'dark' : 'light'}
      tintColor={colours.accent}
      style={[
        {
          alignSelf: 'stretch',
          height: NATIVE_SEGMENTED_HEIGHT,
          width: '100%',
          maxWidth: viewportWidth,
        },
        style,
      ]}
      testID={testID ?? accessibilityLabel}
      onValueChange={label => {
        const match = options.find(option => option.label === label)
        if (match && !match.disabled) {
          onValueChange(match.value)
        }
      }}
    />
  )
}
