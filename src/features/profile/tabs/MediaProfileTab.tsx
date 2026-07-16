import {FlatList, StyleSheet, View, useWindowDimensions} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {AppIcon} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {InitialLoadingState, QueryErrorState} from '@/components/data'
import {parseProfileId} from '@/api/contracts'
import {useProfileFeedQuery} from '@/features/feed/data'
import type {MediaSocialPost} from '@/domain/social'
import type {ProfileTabRendererProps} from '@/features/profile/contracts/profileTabs'
import {ProfileTabEmptyState} from '@/features/profile/components/ProfileTabEmptyState'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type ProfileMediaItem = {
  post: MediaSocialPost
  mediaId: string
  title: string
  colour: string
}

export function MediaProfileTab({profile, viewer}: ProfileTabRendererProps) {
  const router = useRouter()
  const {width} = useWindowDimensions()
  const {colours, radius, spacing} = useThemeTokens()
  const postsQuery = useProfileFeedQuery(parseProfileId(profile.id))
  const columns = width >= 1280 ? 6 : width >= 760 ? 4 : 3
  const items: ProfileMediaItem[] = (postsQuery.data?.pages.flatMap(page => page.items) ?? [])
    .filter((post): post is MediaSocialPost => post.author.id === profile.id && post.kind === 'media')
    .flatMap(post =>
      post.media.map(media => ({
        post,
        mediaId: media.id,
        title: media.title ?? 'Profile media',
        colour: media.colour ?? colours.surfaceMuted,
      })),
    )

  if (postsQuery.isLoading) {
    return <InitialLoadingState label="Loading media" />
  }

  if (postsQuery.isError) {
    return <QueryErrorState error={postsQuery.error} onRetry={() => void postsQuery.refetch()} />
  }

  if (!items.length) {
    return (
      <ProfileTabEmptyState
        icon="photo"
        title={
          viewer.relationship === 'owner'
            ? 'Media you publish will appear here.'
            : 'No public media yet.'
        }
        description="Images and media posts become part of the profile surface."
      />
    )
  }

  return (
    <FlatList
      key={columns}
      data={items}
      keyExtractor={item => item.mediaId}
      numColumns={columns}
      scrollEnabled={false}
      contentContainerStyle={[styles.grid, {gap: spacing[1], padding: spacing[1]}]}
      columnWrapperStyle={{gap: spacing[1]}}
      renderItem={({item}) => (
        <AppPressable
          accessibilityLabel={`Open media post ${item.title}`}
          onPress={() => router.push(`/post/${item.post.id}` as Href)}
          style={[
            styles.tile,
            {
              backgroundColor: item.colour || colours.surfaceMuted,
              borderRadius: radius.small,
            },
          ]}>
          <View
            style={[
              styles.tileScrim,
              {backgroundColor: colours.backdrop, opacity: 0.12, pointerEvents: 'none'},
            ]}
          />
          <AppIcon name="photo" colour={colours.surface} />
          <AppText
            variant="micro"
            numberOfLines={2}
            style={[styles.tileLabel, {color: colours.surface}]}>
            {item.title}
          </AppText>
        </AppPressable>
      )}
    />
  )
}

const styles = StyleSheet.create({
  grid: {
    minWidth: 0,
  },
  tile: {
    alignItems: 'center',
    aspectRatio: 1,
    flex: 1,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  tileLabel: {
    bottom: 8,
    left: 8,
    position: 'absolute',
    right: 8,
  },
  tileScrim: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
})
