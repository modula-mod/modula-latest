import {useEffect, useMemo, useState} from 'react'
import {Modal, Platform, StyleSheet, View} from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import {Gesture, GestureDetector} from 'react-native-gesture-handler'
import {scheduleOnRN} from 'react-native-worklets'
import * as Haptics from 'expo-haptics'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppIcon} from '@/components/primitives/AppIcon'
import {PostSurface} from '@/features/social/posts/components/post-surface'
import {CustomReactionPicker} from '@/features/social/posts/interactions/custom-reaction-picker'
import {postSpringConfig} from '@/features/social/posts/interactions/post-interaction-context'
import {reactionIndexFromX} from '@/features/social/posts/state/post-interaction-machine'
import {
  CUSTOM_REACTIONS,
  DEFAULT_REACTIONS,
  type ReactionOption,
} from '@/features/social/posts/state/post-interaction-types'
import type {ReactionType} from '@/domain/social'
import {POST_GEOMETRY} from '@/features/social/posts/tokens/post-geometry'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const SLOT = 52

type ReactionPickerProps = {
  visible: boolean
  customOpen: boolean
  currentReaction: ReactionType | null
  onClose: () => void
  onOpenCustom: () => void
  onSelect: (reaction: ReactionType | null) => void
}

function ReactionCell({
  option,
  selected,
  emphasized,
  onPress,
}: {
  option: ReactionOption
  selected: boolean
  emphasized: boolean
  onPress: () => void
}) {
  const {colours} = useThemeTokens()
  const scale = useSharedValue(1)
  useEffect(() => {
    scale.value = withSpring(emphasized ? 1.42 : selected ? 1.08 : 1, postSpringConfig('rail'))
  }, [emphasized, scale, selected])

  const style = useAnimatedStyle(() => ({
    transform: [{scale: scale.value}, {translateY: emphasized ? -12 : 0}],
  }))

  return (
    <Animated.View style={style}>
      <AppPressable
        accessibilityLabel={option.label}
        accessibilityRole="button"
        accessibilityState={{selected}}
        onPress={onPress}
        style={styles.cell}>
        <AppIcon name={option.icon} colour={colours.mediaOverlayIcon} size={25} />
      </AppPressable>
    </Animated.View>
  )
}

function ReactionPickerRail({
  currentReaction,
  onOpenCustom,
  onSelect,
}: Pick<ReactionPickerProps, 'currentReaction' | 'onOpenCustom' | 'onSelect'>) {
  const {colours, spacing} = useThemeTokens()
  const options = useMemo<ReactionOption[]>(() => [...DEFAULT_REACTIONS, {type: 'custom', icon: 'create', label: 'More'}], [])
  const initialIndex = Math.max(0, options.findIndex(item => item.type === (currentReaction ?? 'like')))
  const [hoverIndex, setHoverIndex] = useState(initialIndex)
  const bloom = useSharedValue(0.92)

  useEffect(() => {
    bloom.value = withTiming(1, {duration: 180})
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined)
  }, [bloom])

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .onUpdate(event => {
          const next = reactionIndexFromX(event.x, SLOT, options.length)
          scheduleOnRN((index: number) => {
            setHoverIndex(current => {
              if (current !== index) {
                void Haptics.selectionAsync().catch(() => undefined)
              }
              return index
            })
          }, next)
        })
        .onEnd(() => {
          scheduleOnRN((index: number) => {
            const target = options[index]
            if (!target) return
            if (target.type === 'custom') {
              onOpenCustom()
              return
            }
            onSelect(
              currentReaction === (target.type as ReactionType)
                ? null
                : (target.type as ReactionType),
            )
          }, hoverIndex)
        }),
    [currentReaction, hoverIndex, onOpenCustom, onSelect, options],
  )

  const bloomStyle = useAnimatedStyle(() => ({
    transform: [{scale: bloom.value}],
  }))

  const choose = (option: ReactionOption) => {
    if (option.type === 'custom') {
      onOpenCustom()
      return
    }
    onSelect(currentReaction === option.type ? null : (option.type as ReactionType))
  }

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.bloomWrap, bloomStyle]}>
        <PostSurface
          role="reaction"
          style={[
            styles.bloom,
            {
              borderColor: colours.borderStrong,
              borderRadius: POST_GEOMETRY.reactionRadius,
              gap: spacing[1],
              paddingHorizontal: spacing[2],
              paddingVertical: spacing[2],
            },
          ]}>
          {options.map((option, index) => (
            <ReactionCell
              key={`${option.type}-${option.icon}`}
              option={option}
              selected={currentReaction === option.type}
              emphasized={hoverIndex === index}
              onPress={() => choose(option)}
            />
          ))}
        </PostSurface>
        <View style={styles.dots}>
          {options.slice(0, 5).map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                {
                  backgroundColor:
                    hoverIndex === index ? colours.accent : colours.mediaOverlaySecondary,
                  opacity: hoverIndex === index ? 1 : 0.45,
                },
              ]}
            />
          ))}
        </View>
      </Animated.View>
    </GestureDetector>
  )
}

export function ReactionPicker({
  visible,
  customOpen,
  currentReaction,
  onClose,
  onOpenCustom,
  onSelect,
}: ReactionPickerProps) {
  const {colours} = useThemeTokens()

  useEffect(() => {
    if (!visible || Platform.OS !== 'web' || typeof document === 'undefined') return undefined

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      onClose()
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose, visible])

  if (!visible) return null

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      <View accessibilityViewIsModal style={[styles.backdrop, {backgroundColor: colours.mediaOverlayScrim}]}>
        <AppPressable
          accessibilityLabel="Close reactions"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        {customOpen ? (
          <CustomReactionPicker
            options={CUSTOM_REACTIONS}
            onSelect={reaction => onSelect(reaction as ReactionType)}
            onClose={onClose}
          />
        ) : (
          <ReactionPickerRail
            key={String(currentReaction ?? 'like')}
            currentReaction={currentReaction}
            onOpenCustom={onOpenCustom}
            onSelect={onSelect}
          />
        )}
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: 160,
  },
  bloom: {
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
  },
  bloomWrap: {
    alignItems: 'center',
    gap: 8,
  },
  cell: {
    alignItems: 'center',
    height: SLOT,
    justifyContent: 'center',
    width: SLOT,
  },
  dot: {
    borderRadius: 999,
    height: 4,
    width: 4,
  },
  dots: {
    flexDirection: 'row',
    gap: 4,
  },
})
