import {FlatList, StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {InitialLoadingState, QueryErrorState} from '@/components/data'
import {parseProfileId} from '@/api/contracts'
import {useProfileFeedQuery} from '@/features/feed/data'
import type {ProfileTabRendererProps} from '@/features/profile/contracts/profileTabs'
import {ProfileTabEmptyState} from '@/features/profile/components/ProfileTabEmptyState'
import {SocialPost} from '@/features/social/components/social-post'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function PostsProfileTab({profile, viewer}: ProfileTabRendererProps) {
  const router = useRouter()
  const {spacing} = useThemeTokens()
  const postsQuery = useProfileFeedQuery(parseProfileId(profile.id))
  const profilePosts = postsQuery.data?.pages.flatMap(page => page.items) ?? []

  if (postsQuery.isLoading) {
    return <InitialLoadingState label="Loading profile posts" />
  }

  if (postsQuery.isError) {
    return <QueryErrorState error={postsQuery.error} onRetry={() => void postsQuery.refetch()} />
  }

  if (!profilePosts.length) {
    return (
      <ProfileTabEmptyState
        icon="comment"
        title={
          viewer.relationship === 'owner'
            ? 'Your profile is ready for its first post.'
            : 'No public posts yet.'
        }
        description={
          viewer.relationship === 'owner'
            ? 'Publish a local post to start shaping your profile surface.'
            : 'Posts shared publicly by this profile will appear here.'
        }
        actionLabel={viewer.relationship === 'owner' ? 'Create Post' : undefined}
        onAction={
          viewer.relationship === 'owner'
            ? () => router.push('/compose' as Href)
            : undefined
        }
      />
    )
  }

  return (
    <View style={[styles.wrap, {paddingBottom: spacing[4]}]}>
      <FlatList
        data={profilePosts}
        keyExtractor={item => item.id}
        renderItem={({item}) => <SocialPost post={item} />}
        scrollEnabled={false}
        onEndReached={() => {
          if (postsQuery.hasNextPage && !postsQuery.isFetchingNextPage) {
            void postsQuery.fetchNextPage()
          }
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    minWidth: 0,
  },
})
