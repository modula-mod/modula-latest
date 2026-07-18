import {Modal, StyleSheet, View} from 'react-native'
import {useState} from 'react'

import {AppIcon} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import type {ReactionType, SocialPost} from '@/domain/social'
import {useReactionMutation} from '@/features/social/data/useReactionMutation'
import {useReduceMotion} from '@/lib/accessibility'
import {lightImpactHaptic} from '@/lib/haptics'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const reactions: {type: ReactionType; emoji: string; label: string}[] = [
  {type: 'like', emoji: '👍', label: 'Like'},
  {type: 'love', emoji: '❤️', label: 'Love'},
  {type: 'celebrate', emoji: '🎉', label: 'Celebrate'},
  {type: 'insightful', emoji: '💡', label: 'Insightful'},
  {type: 'support', emoji: '🤝', label: 'Support'},
  {type: 'funny', emoji: '😄', label: 'Funny'},
]

export function ReactionControl({post}: {post: SocialPost}) {
  const [open, setOpen] = useState(false)
  const mutation = useReactionMutation()
  const reduceMotion = useReduceMotion()
  const {colours, radius, spacing} = useThemeTokens()
  const currentReaction = post.viewerReaction ?? (post.liked ? 'like' : null)
  const selected = reactions.find(item => item.type === currentReaction)
  const label = selected?.label ?? 'Like'

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
        onLongPress={() => setOpen(true)}
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
          <View
            accessibilityRole="menu"
            style={[styles.menu, {backgroundColor: colours.surfaceRaised, borderColor: colours.border, borderRadius: radius.large, gap: spacing[1], padding: spacing[2]}]}>
            {reactions.map(reaction => (
              <AppPressable
                key={reaction.type}
                accessibilityLabel={reaction.label}
                accessibilityRole="menuitem"
                accessibilityState={{selected: currentReaction === reaction.type}}
                onPress={() => choose(currentReaction === reaction.type ? null : reaction.type)}
                style={[styles.option, {backgroundColor: currentReaction === reaction.type ? colours.accentSubtle : undefined, borderRadius: radius.medium}]}>
                <AppText variant="body">{reaction.emoji}</AppText>
                <AppText variant="caption">{reaction.label}</AppText>
              </AppPressable>
            ))}
          </View>
        </AppPressable>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  backdrop: {alignItems: 'center', flex: 1, justifyContent: 'center', padding: 24},
  menu: {borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', flexWrap: 'wrap', maxWidth: 360},
  option: {alignItems: 'center', justifyContent: 'center', minWidth: 96, paddingHorizontal: 8},
  trigger: {alignItems: 'center', flexDirection: 'row', gap: 4},
})
