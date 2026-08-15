import {Modal, Platform, StyleSheet} from 'react-native'
import {useEffect, useState} from 'react'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
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
import {presentModulaActions} from '@/platform/ui/menus/presentModulaActions'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const CANONICAL: {type: ReactionType; emoji: string; label: string}[] = [
  {type: 'like', emoji: '👍', label: 'Like'},
  {type: 'love', emoji: '❤️', label: 'Love'},
  {type: 'laugh', emoji: '😂', label: 'Laugh'},
  {type: 'fire', emoji: '🔥', label: 'Fire'},
]

const CELL = 48

function ProximityOption({
  emoji,
  label,
  selected,
  emphasized,
  reduceMotion,
  onPress,
}: {
  emoji: string
  label: string
  selected: boolean
  emphasized: boolean
  reduceMotion: boolean
  onPress: () => void
}) {
  const {colours, radius} = useThemeTokens()
  const scale = useSharedValue(1)

  useEffect(() => {
    if (reduceMotion) {
      scale.value = 1
      return
    }
    scale.value = withSpring(emphasized ? 1.28 : selected ? 1.08 : 0.92, {damping: 16, stiffness: 220})
  }, [emphasized, reduceMotion, scale, selected])

  const style = useAnimatedStyle(() => ({
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
            backgroundColor: selected || emphasized ? colours.surfaceRaised : 'transparent',
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
  const [hoverIndex, setHoverIndex] = useState(0)
  const mutation = useReactionMutation()
  const reduceMotion = useReduceMotion()
  const {colours, radius, spacing} = useThemeTokens()
  const currentReaction = post.viewerReaction ?? (post.liked ? 'like' : null)
  const selected = CANONICAL.find(item => item.type === currentReaction)
  const label = selected?.label ?? 'Like'
  const useMenu = Platform.OS === 'web' || reduceMotion

  const choose = (reaction: ReactionType | null) => {
    void lightImpactHaptic()
    mutation.mutate({postId: post.id, reaction})
    setOpen(false)
  }

  const openPicker = () => {
    void selectionHaptic()
    if (useMenu) {
      void presentModulaActions({
        title: 'React',
        actions: CANONICAL.map(item => ({id: item.type, label: `${item.emoji} ${item.label}`})),
        cancelLabel: 'Cancel',
      }).then(id => {
        if (!id) return
        const next = id as ReactionType
        choose(currentReaction === next ? null : next)
      })
      return
    }
    setHoverIndex(Math.max(0, CANONICAL.findIndex(item => item.type === (currentReaction ?? 'like'))))
    setOpen(true)
  }

  const bloomScale = useSharedValue(reduceMotion ? 1 : 0.9)
  useEffect(() => {
    if (!open) return
    bloomScale.value = reduceMotion ? 1 : withTiming(1, {duration: 140})
  }, [bloomScale, open, reduceMotion])
  const bloomStyle = useAnimatedStyle(() => ({transform: [{scale: bloomScale.value}]}))

  return (
    <>
      <AppPressable
        accessibilityLabel={`${label}${post.likeCount ? `, ${post.likeCount} likes` : ''}. Long press for reactions`}
        accessibilityHint="Double tap to like. Long press to choose a reaction."
        accessibilityState={{selected: Boolean(selected), busy: mutation.isPending}}
        onPress={() => choose(currentReaction === 'like' ? null : 'like')}
        onLongPress={openPicker}
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
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderMove={event => {
              const next = Math.min(
                CANONICAL.length - 1,
                Math.max(0, Math.floor(event.nativeEvent.locationX / CELL)),
              )
              setHoverIndex(current => {
                if (current !== next) void selectionHaptic()
                return next
              })
            }}
            onResponderRelease={() => {
              const target = CANONICAL[hoverIndex]
              if (target) choose(currentReaction === target.type ? null : target.type)
            }}
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
            {CANONICAL.map((reaction, index) => (
              <ProximityOption
                key={reaction.type}
                emoji={reaction.emoji}
                label={reaction.label}
                selected={currentReaction === reaction.type}
                emphasized={hoverIndex === index}
                reduceMotion={reduceMotion}
                onPress={() => choose(currentReaction === reaction.type ? null : reaction.type)}
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
    height: CELL,
    justifyContent: 'center',
    width: CELL,
  },
  trigger: {alignItems: 'center', flexDirection: 'row', gap: 4},
})
