import {StyleSheet, View} from 'react-native'

import {Divider} from '@/components/primitives/Divider'
import type {SocialPost as SocialPostModel} from '@/domain/social'
import {openPostMoreMenu} from '@/features/feed/postActions/openPostMoreMenu'
import {MediaPostCard} from '@/features/social/components/media-post-card'
import {useAppServices} from '@/runtime'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'
import {PostActions} from './post-actions'
import {PostBody} from './post-body'
import {PostHeader} from './post-header'

type SocialPostProps = {
  post: SocialPostModel
  compact?: boolean
  showDivider?: boolean
}

/**
 * Provider-neutral feed row.
 * `compact` is the Home cell: white grouped surface on a muted canvas
 * (siren.uix LinkedIn redesign — identity row, not nested card soup).
 */
export function SocialPost({post, compact = false, showDivider = true}: SocialPostProps) {
  const {colours, radius, spacing} = useThemeTokens()
  const {moderationRepository} = useAppServices()
  const padV = compact ? spacing[3] : spacing[3]
  const padH = compact ? spacing[3] : spacing[4]

  const inner =
    post.kind === 'media' ? (
      <View style={{paddingVertical: padV, paddingHorizontal: padH}}>
        <MediaPostCard post={post} />
      </View>
    ) : (
      <View style={[styles.content, {gap: spacing[2], paddingVertical: padV, paddingHorizontal: padH}]}>
        <PostHeader
          post={post}
          avatarSize={compact ? 48 : 40}
          onMore={() => void openPostMoreMenu(post, {moderationRepository})}
        />
        <PostBody post={post} />
        <PostActions post={post} />
      </View>
    )

  if (compact) {
    return (
      <View
        style={[
          styles.cell,
          {
            backgroundColor: colours.surface,
            borderRadius: radius.large,
            marginHorizontal: spacing[3],
            marginBottom: spacing[2],
          },
        ]}>
        {inner}
      </View>
    )
  }

  return (
    <View>
      {inner}
      {showDivider ? <Divider /> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  cell: {overflow: 'hidden'},
  content: {minWidth: 0},
})
