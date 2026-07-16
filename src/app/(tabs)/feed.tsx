import {ActivityIndicator, View} from 'react-native'

import {AppList} from '@/components/primitives/AppList'
import {AppScreen} from '@/components/primitives/AppScreen'
import {AppText} from '@/components/primitives/AppText'
import {FeedPostRow} from '@/features/feed/FeedPostRow'
import {useDevelopmentFeed} from '@/features/feed/useDevelopmentFeed'
import {ComposerFab} from '@/shell/ComposerFab'
import {ScreenHeader} from '@/shell/ScreenHeader'
import {useTheme} from '@/theme/runtime/useTheme'

export default function FeedScreen() {
  const {colours} = useTheme()
  const {posts, loading, error, refresh} = useDevelopmentFeed()

  return (
    <AppScreen padded={false}>
      <ScreenHeader title="Feed" />
      {loading && posts.length === 0 ? (
        <View style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
          <ActivityIndicator color={colours.accent} />
        </View>
      ) : error ? (
        <View style={{flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24}}>
          <AppText colour="destructive">{error}</AppText>
          <AppText colour="accent" onPress={() => void refresh()} style={{marginTop: 12}}>
            Retry
          </AppText>
        </View>
      ) : (
        <AppList
          data={posts}
          keyExtractor={item => item.id}
          renderItem={({item}) => (
            <FeedPostRow post={item} />
          )}
          onRefresh={() => void refresh()}
          refreshing={loading}
        />
      )}
      <ComposerFab />
    </AppScreen>
  )
}
