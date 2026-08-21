import {useEffect, useRef} from 'react'
import {Platform, Pressable, StyleSheet, TextInput, type View} from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import {scheduleOnRN} from 'react-native-worklets'

import {AppText} from '@/components/primitives/AppText'
import {selectionHaptic} from '@/lib/haptics'
import {useReduceMotion} from '@/lib/accessibility'
import {ModulaIcon} from '@/platform/ui/icons'
import {LiquidGlassChrome} from '@/platform/ui/materials/liquid-glass-chrome'
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
  const {colours, radius, spacing, motion} = useThemeTokens()
  const reduceMotion = useReduceMotion()
  const inputRef = useRef<TextInput>(null)
  const triggerRef = useRef<View>(null)
  const active = isProductHubSearchActive(model.state) || model.state === 'SEARCH_COLLAPSING'
  const expanded = isProductHubSearchActive(model.state)
  const progress = useSharedValue(expanded ? 1 : compact ? 0 : 1)
  const duration = reduceMotion ? motion.micro || 120 : motion.normal

  useEffect(() => {
    const next = expanded || !compact ? 1 : 0
    const shouldSettle = model.state === 'SEARCH_EXPANDING' || model.state === 'SEARCH_COLLAPSING'
    if (reduceMotion) {
      progress.value = next
      if (shouldSettle) onSettled()
      return undefined
    }
    progress.value = withTiming(next, {duration, easing: Easing.out(Easing.cubic)}, finished => {
      'worklet'
      if (finished && shouldSettle) {
        scheduleOnRN(onSettled)
      }
    })
    return undefined
  }, [compact, duration, expanded, model.state, onSettled, progress, reduceMotion])

  useEffect(() => {
    if (model.state === 'SEARCH_ACTIVE' || model.state === 'SEARCH_RESULTS' || model.state === 'SEARCH_EMPTY') {
      const timer = setTimeout(() => inputRef.current?.focus(), reduceMotion ? 0 : motion.fast)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [model.state, motion.fast, reduceMotion])

  const fieldStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{translateX: (1 - progress.value) * 16}],
  }))

  const cancelSearch = () => {
    onCancel()
    if (Platform.OS === 'web') {
      setTimeout(() => {
        ;(triggerRef.current as unknown as HTMLElement | null)?.focus?.()
      }, reduceMotion ? 0 : duration)
    }
  }

  const triggerSearch = () => {
    void selectionHaptic()
    onTrigger()
  }

  if (compact && !active) {
    return (
      <LiquidGlassChrome
        interactive
        fallback="regular"
        style={[styles.glassTrigger, {borderRadius: radius.round}]}>
        <Pressable
          ref={triggerRef}
          accessibilityRole="button"
          accessibilityLabel="Search Product Hub"
          onPress={triggerSearch}
          testID="product-hub-search-trigger"
          hitSlop={8}
          style={styles.trigger}>
          <ModulaIcon name="search" size={18} colour={colours.text} />
        </Pressable>
      </LiquidGlassChrome>
    )
  }

  return (
    <Animated.View
      style={[
        styles.field,
        {
          backgroundColor: colours.surfaceRaised,
          borderColor: colours.border,
          borderRadius: radius.round,
          paddingHorizontal: spacing[3],
          flex: 1,
          minWidth: 0,
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
          onSubmitEditing={() => undefined}
          placeholder="Search modules, tools and more…"
          placeholderTextColor={colours.textTertiary}
          accessibilityLabel="Search Product Hub"
          accessibilityRole="search"
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="never"
          style={[
            styles.input,
            {color: colours.text},
            Platform.OS === 'web'
              ? ({
                  outlineWidth: 2,
                  outlineColor: colours.accent,
                  outlineOffset: 2,
                } as object)
              : null,
          ]}
          testID="product-hub-search-input"
        />
      ) : (
        <Pressable
          ref={triggerRef}
          accessibilityRole="button"
          accessibilityLabel="Search Product Hub"
          onPress={triggerSearch}
          style={styles.idleHit}>
          <AppText variant="body" colour="textTertiary">
            Search Product Hub
          </AppText>
        </Pressable>
      )}
      {expanded ? (
        <>
          {model.query ? (
            <Pressable
              accessibilityLabel="Clear search"
              onPress={() => onChangeText('')}
              hitSlop={8}
              testID="product-hub-search-clear">
              <ModulaIcon name="close" size={17} colour={colours.textTertiary} />
            </Pressable>
          ) : null}
          <Pressable accessibilityLabel="Cancel search" onPress={cancelSearch} hitSlop={8} testID="product-hub-search-cancel">
            <AppText variant="buttonLabel" colour="accent">
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
  glassTrigger: {
    height: 36,
    width: 36,
  },
  idleHit: {flex: 1, justifyContent: 'center', minHeight: 44},
  input: {flex: 1, fontSize: 16, minHeight: 44, paddingVertical: 8},
  trigger: {alignItems: 'center', flex: 1, justifyContent: 'center'},
})
