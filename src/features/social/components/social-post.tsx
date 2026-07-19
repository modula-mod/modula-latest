import {StyleSheet, View} from 'react-native'

import {Divider} from '@/components/primitives/Divider'
import type {SocialPost as SocialPostModel} from '@/domain/social'
import {openPostMoreMenu} from '@/features/feed/postActions/openPostMoreMenu'
import {MediaPostCard} from '@/features/social/components/media-post-card'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'
import {PostActions} from './post-actions'
import {PostBody} from './post-body'
import {PostHeader} from './post-header'

type SocialPostProps = {
  post: SocialPostModel
  compact?: boolean
  showDivider?: boolean
}

/** Provider-neutral presentation for feed rows, post detail, and embedded posts. */
export function SocialPost({post, compact = false, showDivider = true}: SocialPostProps) {
  const {spacing} = useThemeTokens()

  if (post.kind === 'media') {
    return (
      <View>
        <View
          style={[
            styles.content,
            {padding: compact ? spacing[3] : spacing[4]},
          ]}>
          <MediaPostCard post={post} />
        </View>
        {showDivider ? <Divider /> : null}
      </View>
    )
  }

  return (
    <View>
      <View style={[styles.content, {gap: spacing[2], padding: compact ? spacing[3] : spacing[4]}]}>
        <PostHeader post={post} onMore={() => void openPostMoreMenu(post)} />
        <PostBody post={post} />
        <PostActions post={post} />
      </View>
      {showDivider ? <Divider /> : null}
    </View>
  )
}

const styles = StyleSheet.create({content: {minWidth: 0}})
