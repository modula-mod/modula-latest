import {FlatList, StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {DemoPostItem} from '@/components/feed/DemoPostItem'
import {useDemoSocial} from '@/demo/DemoSocialContext'
import type {ProfileTabRendererProps} from '@/features/profile/contracts/profileTabs'
import {ProfileTabEmptyState} from '@/features/profile/components/ProfileTabEmptyState'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function PostsProfileTab({profile, viewer}: ProfileTabRendererProps) {
  const router = useRouter()
  const {posts} = useDemoSocial()
  const {spacing} = useThemeTokens()
  const profilePosts = posts.filter(post => post.author.id === profile.id)

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
        renderItem={({item}) => <DemoPostItem post={item} />}
        scrollEnabled={false}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    minWidth: 0,
  },
})
