import {FlatList, StyleSheet, View} from 'react-native'

import {ProtectedActionPrompt} from '@/auth/components/ProtectedActionPrompt'
import {useCapability} from '@/auth/runtime'
import {InitialLoadingState, QueryErrorState} from '@/components/data'
import {DemoPostItem} from '@/components/feed/DemoPostItem'
import {EmptyState} from '@/components/primitives/EmptyState'
import {AppText} from '@/components/primitives/AppText'
import {useSavedPostsQuery} from '@/features/saved/data'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function SavedPostsScreen() {
  const canManageSaved = useCapability('saved:manage')
  const savedQuery = useSavedPostsQuery()
  const {colours, spacing} = useThemeTokens()
  const posts = savedQuery.data?.pages.flatMap(page => page.items) ?? []

  if (!canManageSaved) {
    return (
      <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
        <SecondaryScreenHeader title="Saved" />
        <ProtectedActionPrompt
          visible
          description="Sign in to manage saved posts in this local Modula build."
        />
      </View>
    )
  }

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title="Saved" />
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
              renderItem={({item}) => <DemoPostItem post={item} />}
              onEndReached={() => {
                if (savedQuery.hasNextPage && !savedQuery.isFetchingNextPage) {
                  void savedQuery.fetchNextPage()
                }
              }}
            />
          ) : (
            <View style={{gap: spacing[3]}}>
              <AppText variant="display">Saved</AppText>
              <EmptyState
                icon="bookmark"
                title="No saved posts yet"
                description="Save posts from Home or profiles to build a local knowledge trail."
              />
            </View>
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
