import {useEffect, useRef} from 'react'
import {Platform, Pressable, StyleSheet, TextInput, type View} from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

import {AppText} from '@/components/primitives/AppText'
import {useReduceMotion} from '@/lib/accessibility'
import {ModulaIcon} from '@/platform/ui/icons'
import {
  isProductHubSearchActive,
  type ProductHubSearchModel,
} from '@/features/modules/state/productHubSearchMachine'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function ProductHubSearchChrome({
  model,
  compact,
  onTrigger,
  onChangeText,
  onCancel,
  onSettled,
}: {
  model: ProductHubSearchModel
  compact: boolean
  onTrigger: () => void
  onChangeText: (text: string) => void
  onCancel: () => void
  onSettled: () => void
}) {
  const {colours, radius, spacing} = useThemeTokens()
  const reduceMotion = useReduceMotion()
  const inputRef = useRef<TextInput>(null)
  const triggerRef = useRef<View>(null)
  const active = isProductHubSearchActive(model.state) || model.state === 'SEARCH_COLLAPSING'
  const expanded = isProductHubSearchActive(model.state)
  const progress = useSharedValue(expanded ? 1 : compact ? 0 : 1)

  useEffect(() => {
    const next = expanded || !compact ? 1 : 0
    progress.value = reduceMotion ? next : withTiming(next, {duration: 220})
    if (model.state === 'SEARCH_EXPANDING' || model.state === 'SEARCH_COLLAPSING') {
      const timer = setTimeout(onSettled, reduceMotion ? 0 : 220)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [compact, expanded, model.state, onSettled, progress, reduceMotion])

  useEffect(() => {
    if (model.state === 'SEARCH_ACTIVE' || model.state === 'SEARCH_RESULTS') {
      const timer = setTimeout(() => inputRef.current?.focus(), reduceMotion ? 0 : 180)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [model.state, reduceMotion])

  const fieldStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{translateX: (1 - progress.value) * 12}],
  }))

  const cancelSearch = () => {
    onCancel()
    if (Platform.OS === 'web') {
      setTimeout(() => {
        ;(triggerRef.current as unknown as HTMLElement | null)?.focus?.()
      }, reduceMotion ? 0 : 230)
    }
  }

  if (compact && !active) {
    return (
      <Pressable
        ref={triggerRef}
        accessibilityRole="button"
        accessibilityLabel="Search Product Hub"
        onPress={onTrigger}
        testID="product-hub-search-trigger"
        hitSlop={8}
        style={styles.trigger}>
        <ModulaIcon name="search" size={20} colour={colours.text} />
      </Pressable>
    )
  }

  return (
    <Animated.View
      style={[
        styles.field,
        {
          backgroundColor: colours.surfaceRaised,
          borderColor: colours.border,
          borderRadius: radius.large,
          paddingHorizontal: spacing[3],
        },
        fieldStyle,
      ]}
      testID="product-hub-search-field">
      <ModulaIcon name="search" size={18} colour={colours.textTertiary} />
      {expanded ? (
        <TextInput
          ref={inputRef}
          value={model.query}
          onChangeText={onChangeText}
          onKeyPress={event => {
            if (event.nativeEvent.key === 'Escape') cancelSearch()
          }}
          placeholder="Search modules, tools and more…"
          placeholderTextColor={colours.textTertiary}
          accessibilityLabel="Search Product Hub"
          accessibilityRole="search"
          returnKeyType="search"
          autoCorrect={false}
          style={[styles.input, {color: colours.text}]}
          testID="product-hub-search-input"
        />
      ) : (
        <Pressable
          ref={triggerRef}
          accessibilityRole="button"
          accessibilityLabel="Search Product Hub"
          onPress={onTrigger}
          style={styles.idleHit}>
          <AppText variant="body" colour="textTertiary">
            Search Product Hub
          </AppText>
        </Pressable>
      )}
      {expanded ? (
        <>
          {model.query ? (
            <Pressable accessibilityLabel="Clear search" onPress={() => onChangeText('')} hitSlop={8} testID="product-hub-search-clear">
              <ModulaIcon name="close" size={17} colour={colours.textTertiary} />
            </Pressable>
          ) : null}
          <Pressable accessibilityLabel="Cancel search" onPress={cancelSearch} hitSlop={8} testID="product-hub-search-cancel">
            <AppText variant="label" colour="accent">
              Cancel
            </AppText>
          </Pressable>
        </>
      ) : null}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  field: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 8,
    minHeight: 44,
  },
  idleHit: {flex: 1, justifyContent: 'center', minHeight: 44},
  input: {flex: 1, fontSize: 16, minHeight: 44, paddingVertical: 8},
  trigger: {alignItems: 'center', height: 36, justifyContent: 'center', width: 36},
})
