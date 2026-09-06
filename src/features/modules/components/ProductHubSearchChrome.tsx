import {useEffect, useRef} from 'react'
import {StyleSheet, type TextInput as RNTextInput} from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import {scheduleOnRN} from 'react-native-worklets'

import {selectionHaptic} from '@/lib/haptics'
import {useReduceMotion} from '@/lib/accessibility'
import {ModulaIconButton} from '@/platform/ui/buttons/modula-icon-button'
import {ModulaSearchField} from '@/platform/ui/controls/modula-search-field'
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
  const {motion} = useThemeTokens()
  const reduceMotion = useReduceMotion()
  const inputRef = useRef<RNTextInput>(null)
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
  }

  const triggerSearch = () => {
    void selectionHaptic()
    onTrigger()
  }

  if (compact && !active) {
    return (
      <ModulaIconButton
        accessibilityLabel="Search Product Hub"
        chrome="glass"
        icon="search"
        onPress={triggerSearch}
        testID="product-hub-search-trigger"
      />
    )
  }

  return (
    <Animated.View
      style={[styles.field, fieldStyle]}
      testID="product-hub-search-field">
      <ModulaSearchField
        ref={inputRef}
        accessibilityLabel="Search Product Hub"
        autoCapitalize="none"
        autoCorrect={false}
        editable={expanded}
        onActivate={expanded ? undefined : triggerSearch}
        onCancel={expanded ? cancelSearch : undefined}
        onChangeText={onChangeText}
        onEscape={cancelSearch}
        placeholder="Search modules, tools and more…"
        style={styles.sharedField}
        testID="product-hub-search-input"
        value={model.query}
        variant="product"
      />
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  field: {
    flex: 1,
    minWidth: 0,
  },
  sharedField: {
    flex: 1,
  },
})
