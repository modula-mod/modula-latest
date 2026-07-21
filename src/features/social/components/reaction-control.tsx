import {Modal, StyleSheet, View} from 'react-native'
import {useEffect, useState} from 'react'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated'

import {AppIcon} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import type {ReactionType, SocialPost} from '@/domain/social'
import {useReactionMutation} from '@/features/social/data/useReactionMutation'
import {useReduceMotion} from '@/lib/accessibility'
import {lightImpactHaptic, selectionHaptic} from '@/lib/haptics'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const reactions: {type: ReactionType; emoji: string; label: string}[] = [
  {type: 'like', emoji: '👍', label: 'Like'},
  {type: 'love', emoji: '❤️', label: 'Love'},
  {type: 'celebrate', emoji: '🎉', label: 'Celebrate'},
  {type: 'insightful', emoji: '💡', label: 'Insightful'},
  {type: 'support', emoji: '🤝', label: 'Support'},
  {type: 'funny', emoji: '😄', label: 'Funny'},
]

function BloomOption({
  emoji,
  label,
  selected,
  index,
  reduceMotion,
  onPress,
}: {
  emoji: string
  label: string
  selected: boolean
  index: number
  reduceMotion: boolean
  onPress: () => void
}) {
  const {colours, radius} = useThemeTokens()
  const scale = useSharedValue(reduceMotion ? 1 : 0.4)
  const opacity = useSharedValue(reduceMotion ? 1 : 0)

  useEffect(() => {
    if (reduceMotion) {
      scale.value = 1
      opacity.value = 1
      return
    }
    scale.value = withDelay(index * 28, withSpring(1, {damping: 14, stiffness: 220}))
    opacity.value = withDelay(index * 28, withTiming(1, {duration: 120}))
  }, [index, opacity, reduceMotion, scale])

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{scale: scale.value}],
  }))

  return (
    <Animated.View style={style}>
      <AppPressable
        accessibilityLabel={label}
        accessibilityRole="menuitem"
        accessibilityState={{selected}}
        onPress={onPress}
        style={[
          styles.option,
          {
            backgroundColor: selected ? colours.accentSubtle : colours.surface,
            borderRadius: radius.round,
          },
        ]}>
        <AppText variant="title">{emoji}</AppText>
      </AppPressable>
    </Animated.View>
  )
}

export function ReactionControl({post}: {post: SocialPost}) {
  const [open, setOpen] = useState(false)
  const mutation = useReactionMutation()
  const reduceMotion = useReduceMotion()
  const {colours, radius, spacing} = useThemeTokens()
  const currentReaction = post.viewerReaction ?? (post.liked ? 'like' : null)
  const selected = reactions.find(item => item.type === currentReaction)
  const label = selected?.label ?? 'Like'
  const bloomScale = useSharedValue(reduceMotion ? 1 : 0.85)

  useEffect(() => {
    if (!open) return
    if (reduceMotion) {
      bloomScale.value = 1
      return
    }
    bloomScale.value = 0.85
    bloomScale.value = withSpring(1, {damping: 16, stiffness: 200})
  }, [bloomScale, open, reduceMotion])

  const bloomStyle = useAnimatedStyle(() => ({
    transform: [{scale: bloomScale.value}],
  }))

  const choose = (reaction: ReactionType | null) => {
    void lightImpactHaptic()
    mutation.mutate({postId: post.id, reaction})
    setOpen(false)
  }

  return (
    <>
      <AppPressable
        accessibilityLabel={`${label}${post.likeCount ? `, ${post.likeCount} likes` : ''}. Long press for reactions`}
        accessibilityHint="Double tap to like. Long press to choose a reaction."
        accessibilityState={{selected: Boolean(selected), busy: mutation.isPending}}
        onPress={() => choose(currentReaction === 'like' ? null : 'like')}
        onLongPress={() => {
          void selectionHaptic()
          setOpen(true)
        }}
        delayLongPress={350}
        style={styles.trigger}>
        <AppIcon name="like" colour={selected ? colours.accent : colours.textSecondary} size={20} />
        <AppText variant="caption" style={{color: selected ? colours.accent : colours.textSecondary}}>
          {selected ? label : post.likeCount || ''}
        </AppText>
      </AppPressable>
      <Modal
        transparent
        visible={open}
        animationType={reduceMotion ? 'none' : 'fade'}
        onRequestClose={() => setOpen(false)}>
        <AppPressable
          accessibilityLabel="Close reaction choices"
          onPress={() => setOpen(false)}
          style={[styles.backdrop, {backgroundColor: colours.surfaceOverlay}]}>
          <Animated.View
            accessibilityRole="menu"
            style={[
              styles.bloom,
              bloomStyle,
              {
                backgroundColor: colours.surfaceRaised,
                borderColor: colours.border,
                borderRadius: radius.round,
                gap: spacing[1],
                paddingHorizontal: spacing[2],
                paddingVertical: spacing[2],
              },
            ]}>
            {reactions.map((reaction, index) => (
              <BloomOption
                key={reaction.type}
                emoji={reaction.emoji}
                label={reaction.label}
                selected={currentReaction === reaction.type}
                index={index}
                reduceMotion={reduceMotion}
                onPress={() =>
                  choose(currentReaction === reaction.type ? null : reaction.type)
                }
              />
            ))}
          </Animated.View>
        </AppPressable>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: 120,
    paddingHorizontal: 16,
  },
  bloom: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  option: {
    alignItems: 'center',
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  trigger: {alignItems: 'center', flexDirection: 'row', gap: 4},
})
