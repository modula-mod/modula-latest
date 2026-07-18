import {StyleSheet} from 'react-native'

import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import type {SocialPost} from '@/domain/social'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'
import {PostHeader} from './post-header'

export function QuotedPost({post}: {post: SocialPost | null | undefined}) {
  const {spacing} = useThemeTokens()
  if (!post) {
    return (
      <Surface variant="contained" style={[styles.container, {padding: spacing[3]}]}>
        <AppText variant="caption" colour="textSecondary">This post is no longer available.</AppText>
      </Surface>
    )
  }
  return (
    <Surface variant="contained" style={[styles.container, {gap: spacing[2], padding: spacing[3]}]}>
      <PostHeader post={post} />
      {post.text ? <AppText variant="body" numberOfLines={4}>{post.text}</AppText> : null}
    </Surface>
  )
}

const styles = StyleSheet.create({container: {overflow: 'hidden'}})
