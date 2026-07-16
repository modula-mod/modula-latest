import {useState} from 'react'
import {FlatList, StyleSheet, View, useWindowDimensions} from 'react-native'
import {LinearGradient} from 'expo-linear-gradient'
import {Stack, useRouter} from 'expo-router'
import {useSafeAreaInsets} from 'react-native-safe-area-context'

import {InitialLoadingState, QueryErrorState} from '@/components/data'
import {AppIcon} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {Avatar} from '@/components/primitives/Avatar'
import {FeatureErrorBoundary} from '@/components/system/FeatureErrorBoundary'
import {useSession} from '@/auth/runtime'
import {getProfileRouteForIdentity} from '@/features/profile/navigation/openProfile'
import {useReelsQuery} from '@/features/reels/data'
import {selectionHaptic} from '@/lib/haptics'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'
import type {ReelItem as ReelItemType} from '@/domain/discovery'

export function ReelsScreen() {
  const {height, width} = useWindowDimensions()
  const {colours} = useThemeTokens()
  const reelsQuery = useReelsQuery()

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Reels',
          headerTransparent: true,
          headerTintColor: colours.mediaOverlayText,
          headerStyle: {backgroundColor: 'transparent'},
        }}
      />
      <FeatureErrorBoundary label="Reels">
        {reelsQuery.isLoading ? (
          <InitialLoadingState label="Loading reels" />
        ) : reelsQuery.isError ? (
          <QueryErrorState error={reelsQuery.error} onRetry={() => void reelsQuery.refetch()} />
        ) : (
          <FlatList
            data={reelsQuery.data ?? []}
            keyExtractor={item => item.id}
            pagingEnabled
            showsVerticalScrollIndicator={false}
            renderItem={({item}) => (
              <ReelItem reel={item} height={height} width={width} />
            )}
          />
        )}
      </FeatureErrorBoundary>
    </View>
  )
}

function ReelItem({
  reel,
  height,
  width,
}: {
  reel: ReelItemType
  height: number
  width: number
}) {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [liked, setLiked] = useState(reel.liked)
  const session = useSession()
  const {colours, spacing} = useThemeTokens()
  const ownerProfileId = session.status === 'signedIn' ? session.profile.id : ''
  const profileRoute = getProfileRouteForIdentity(reel.author, ownerProfileId)

  return (
    <View style={[styles.item, {height, width, backgroundColor: colours.surface1}]}>
      {/* Editorial still — never a flat accent-only fill across the screen. */}
      <LinearGradient
        colors={[colours.surface1, reel.colour, colours.surface3]}
        locations={[0, 0.45, 1]}
        start={{x: 0.15, y: 0}}
        end={{x: 0.9, y: 1}}
        style={StyleSheet.absoluteFill}
      />
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, {backgroundColor: colours.mediaOverlayScrim}]}
      />

      <View
        style={[
          styles.bottomRow,
          {
            paddingBottom: Math.max(insets.bottom, spacing[4]),
            paddingHorizontal: spacing[4],
            gap: spacing[3],
          },
        ]}>
        <View style={[styles.caption, {gap: spacing[2]}]}>
          <AppPressable
            accessibilityLabel={`Open ${reel.author.displayName} profile`}
            onPress={() => router.push(profileRoute)}
            style={styles.creator}>
            <Avatar
              name={reel.author.displayName}
              uri={reel.author.avatarUri}
              colour={reel.author.coverColour}
              size={36}
            />
            <AppText variant="headline" style={{color: colours.mediaOverlayText}}>
              {reel.author.displayName}
            </AppText>
          </AppPressable>
          <AppText variant="body" style={{color: colours.mediaOverlayText}}>
            {reel.caption}
          </AppText>
          <AppText variant="caption" style={{color: colours.mediaOverlaySecondary}}>
            Preview · {reel.source}
          </AppText>
        </View>
        <View style={styles.rail}>
          {(
            [
              {label: 'Like post', icon: 'like' as const, action: 'like'},
              {label: 'Reply', icon: 'comment' as const, action: 'reply'},
              {label: 'Share', icon: 'share' as const, action: 'share'},
              {label: 'Open post actions', icon: 'more' as const, action: 'more'},
            ] as const
          ).map(action => (
            <AppPressable
              key={action.action}
              accessibilityLabel={action.label}
              accessibilityState={{
                selected: action.action === 'like' ? liked : undefined,
              }}
              onPress={() => {
                if (action.action === 'like') {
                  void selectionHaptic()
                  setLiked(value => !value)
                }
              }}
              style={[
                styles.railButton,
                {backgroundColor: colours.mediaOverlayControlBackground},
              ]}>
              <AppIcon name={action.icon} colour={colours.mediaOverlayIcon} size={22} />
              {action.action === 'like' ? (
                <AppText
                  variant="caption"
                  style={{color: colours.mediaOverlayText, fontVariant: ['tabular-nums']}}>
                  {reel.likeCount + (liked && !reel.liked ? 1 : 0)}
                </AppText>
              ) : null}
            </AppPressable>
          ))}
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  bottomRow: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
  },
  caption: {
    flex: 1,
    minWidth: 0,
  },
  creator: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  item: {
    overflow: 'hidden',
  },
  rail: {
    gap: 10,
  },
  railButton: {
    alignItems: 'center',
    borderRadius: 999,
    justifyContent: 'center',
    minHeight: 48,
    minWidth: 48,
    padding: 8,
  },
  screen: {
    flex: 1,
  },
})
