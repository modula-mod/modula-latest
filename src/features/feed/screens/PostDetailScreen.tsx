import {useEffect} from 'react'
import {Alert, ScrollView, StyleSheet, View} from 'react-native'
import {useLocalSearchParams, useRouter, type Href} from 'expo-router'

import {parsePostId} from '@/api/contracts'
import {useSession} from '@/auth/runtime'
import {InitialLoadingState, QueryErrorState} from '@/components/data'
import {EmptyState} from '@/components/primitives/EmptyState'
import {useDeletePostMutation, usePostQuery} from '@/features/feed/data'
import {SocialPost} from '@/features/social/components/social-post'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {shareModulaText} from '@/platform/ui/share/share-modula-text'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function PostDetailScreen() {
  const {postId, confirmDelete} = useLocalSearchParams<{postId: string; confirmDelete?: string}>()
  const router = useRouter()
  const session = useSession()
  const deletePost = useDeletePostMutation()
  const {colours} = useThemeTokens()
  let parsedPostId = null
  try {
    parsedPostId = parsePostId(postId)
  } catch {
    parsedPostId = null
  }
  const postQuery = usePostQuery(parsedPostId ?? parsePostId('post-local-1'))
  const post = parsedPostId ? postQuery.data : null

  useEffect(() => {
    if (confirmDelete !== '1' || !post || session.status !== 'signedIn') return
    if (session.profile.id !== post.author.id) return
    Alert.alert('Delete post', 'Delete this post permanently?', [
      {text: 'Cancel', style: 'cancel', onPress: () => router.replace(`/post/${post.id}` as Href)},
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void deletePost
            .mutateAsync(post.id)
            .then(() => router.replace('/' as Href))
            .catch(error => {
              Alert.alert(
                'Delete failed',
                error instanceof Error ? error.message : 'Could not delete post.',
              )
            })
        },
      },
    ])
  }, [confirmDelete, deletePost, post, router, session])

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader
        title="Post"
        onShare={
          post
            ? () =>
                void shareModulaText({
                  title: `${post.author.displayName} on Modula`,
                  message: post.text || 'A post on Modula.',
                })
            : undefined
        }
        overflow={{
          accessibilityLabel: 'Post actions',
          title: 'Post',
          actions: [
            {id: 'share', label: 'Share', icon: 'share'},
            {id: 'profile', label: 'Author profile', icon: 'profile'},
            {id: 'home', label: 'Home', icon: 'home'},
          ],
          onAction: id => {
            if (id === 'share' && post) {
              void shareModulaText({
                title: `${post.author.displayName} on Modula`,
                message: post.text || 'A post on Modula.',
              })
            }
            if (id === 'profile' && post) {
              router.push(`/profile/${encodeURIComponent(post.author.handle)}` as Href)
            }
            if (id === 'home') router.push('/' as Href)
          },
        }}
      />
      <ResponsiveContent>
        {post ? (
          <>
            <ScrollView contentContainerStyle={styles.content}>
              <SocialPost post={post} presentation="detail" />
            </ScrollView>
          </>
        ) : postQuery.isLoading ? (
          <InitialLoadingState label="Loading post" />
        ) : postQuery.isError ? (
          <QueryErrorState error={postQuery.error} onRetry={() => void postQuery.refetch()} />
        ) : (
          <EmptyState icon="comment" title="Post unavailable" description="This post is no longer available." />
        )}
      </ResponsiveContent>
    </View>
  )
}

const styles = StyleSheet.create({
  content: {paddingBottom: 40},
  screen: {flex: 1},
})
