import {FlatList, StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {ProtectedActionPrompt} from '@/auth/components/ProtectedActionPrompt'
import {useCapability} from '@/auth/runtime'
import {InitialLoadingState, QueryErrorState} from '@/components/data'
import {EmptyState} from '@/components/primitives/EmptyState'
import {useSavedPostsQuery} from '@/features/saved/data'
import {SocialPost} from '@/features/social/components/social-post'
import {shareModulaText} from '@/platform/ui/share/share-modula-text'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function SavedPostsScreen() {
  const canManageSaved = useCapability('saved:manage')
  const savedQuery = useSavedPostsQuery()
  const {colours, spacing} = useThemeTokens()
  const router = useRouter()
  const posts = savedQuery.data?.pages.flatMap(page => page.items) ?? []

  const header = (
    <SecondaryScreenHeader
      title="Saved"
      onShare={() =>
        void shareModulaText({
          title: 'Saved on Modula',
          message: 'Posts I saved on Modula.',
        })
      }
      overflow={{
        accessibilityLabel: 'Saved actions',
        title: 'Saved',
        actions: [
          {id: 'discover', label: 'Discover', icon: 'discover'},
          {id: 'home', label: 'Home', icon: 'home'},
          {id: 'collections', label: 'Collections — Preview', icon: 'bookmark'},
        ],
        onAction: id => {
          if (id === 'discover') router.push('/discover' as Href)
          if (id === 'home') router.push('/' as Href)
          if (id === 'collections') router.push('/collections' as Href)
        },
      }}
    />
  )

  if (!canManageSaved) {
    return (
      <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
        {header}
        <ProtectedActionPrompt
          visible
          description="Sign in to manage saved posts in this local Modula build."
        />
      </View>
    )
  }

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      {header}
      <ResponsiveContent>
        <View style={[styles.content, {padding: spacing[4]}]}>
          {savedQuery.isLoading ? (
            <InitialLoadingState label="Loading saved posts" />
          ) : savedQuery.isError ? (
            <QueryErrorState error={savedQuery.error} onRetry={() => void savedQuery.refetch()} />
          ) : posts.length ? (
            <FlatList
              data={posts}
              keyExtractor={item => item.id}
              renderItem={({item}) => <SocialPost post={item} />}
              onEndReached={() => {
                if (savedQuery.hasNextPage && !savedQuery.isFetchingNextPage) {
                  void savedQuery.fetchNextPage()
                }
              }}
            />
          ) : (
            <EmptyState
              icon="bookmark"
              title="No saved posts yet"
              description="Save posts from Home or profiles to build a local knowledge trail."
            />
          )}
        </View>
      </ResponsiveContent>
    </View>
  )
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
  screen: {
    flex: 1,
  },
})
