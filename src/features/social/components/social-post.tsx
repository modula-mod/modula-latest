import {View} from 'react-native'

import type {SocialPost as SocialPostModel} from '@/domain/social'
import {PostShell} from '@/features/social/posts/components/post-shell'
import {Divider} from '@/components/primitives/Divider'

type SocialPostProps = {
  post: SocialPostModel
  compact?: boolean
  showDivider?: boolean
  presentation?: 'feed' | 'detail'
}

/**
 * Provider-neutral feed row using the universal post interaction shell.
 */
export function SocialPost({post, compact = false, showDivider = false, presentation = 'feed'}: SocialPostProps) {
  return (
    <View>
      <PostShell post={post} compact={compact} active presentation={presentation} />
      {!compact && showDivider ? <Divider /> : null}
    </View>
  )
}
