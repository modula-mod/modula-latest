import {useState} from 'react'
import {FlatList, StyleSheet, View, useWindowDimensions} from 'react-native'
import {useRouter} from 'expo-router'
import {useSafeAreaInsets} from 'react-native-safe-area-context'

import {AppIcon} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {Avatar} from '@/components/primitives/Avatar'
import {FeatureErrorBoundary} from '@/components/system/FeatureErrorBoundary'
import {demoReels, type DemoReel} from '@/demo/demoReels'
import {selectionHaptic} from '@/lib/haptics'
import {lightColours} from '@/theme/foundations/colour'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function ReelsScreen() {
  const {height, width} = useWindowDimensions()
  const {colours} = useThemeTokens()

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <FeatureErrorBoundary label="Reels">
        <FlatList
          data={demoReels}
          keyExtractor={item => item.id}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          renderItem={({item}) => (
            <ReelItem reel={item} height={height} width={width} />
          )}
        />
      </FeatureErrorBoundary>
    </View>
  )
}

function ReelItem({
  reel,
  height,
  width,
}: {
  reel: DemoReel
  height: number
  width: number
}) {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [liked, setLiked] = useState(reel.liked)
  const {spacing} = useThemeTokens()

  const overlayColour = lightColours.canvas

  return (
    <View
      style={[
        styles.item,
        {
          backgroundColor: reel.colour,
          height,
          width,
          paddingTop: insets.top + spacing[2],
          paddingBottom: Math.max(insets.bottom, spacing[4]),
          paddingHorizontal: spacing[4],
        },
      ]}>
      <View style={styles.reelPattern} />
      <View style={styles.topRow}>
        <AppPressable
          accessibilityLabel="Back from Reels"
          onPress={() => {
            if (router.canGoBack()) {
              router.back()
            } else {
              router.replace('/')
            }
          }}
          style={styles.reelButton}>
          <AppIcon name="back" colour={overlayColour} />
        </AppPressable>
        <View style={styles.feedSwitch}>
          <AppText variant="label" style={{color: overlayColour}}>
            Following
          </AppText>
          <AppText variant="label" style={{color: overlayColour}}>
            For You
          </AppText>
        </View>
        <View style={styles.reelButton} />
      </View>
      <View style={styles.bottomRow}>
        <View style={[styles.caption, {gap: spacing[2]}]}>
          <View style={styles.creator}>
            <Avatar
              name={reel.author.displayName}
              colour={reel.author.avatarColour}
              size={36}
            />
            <AppText variant="headline" style={{color: overlayColour}}>
              {reel.author.displayName}
            </AppText>
          </View>
          <AppText variant="body" style={{color: overlayColour}}>
            {reel.caption}
          </AppText>
          <AppText variant="caption" style={{color: overlayColour}}>
            {reel.source} · local still preview
          </AppText>
        </View>
        <View style={styles.rail}>
          {[
            {label: 'Profile', icon: 'profile' as const},
            {label: 'Like', icon: 'like' as const},
            {label: 'Reply', icon: 'comment' as const},
            {label: 'Share', icon: 'share' as const},
            {label: 'More', icon: 'more' as const},
          ].map(action => (
            <AppPressable
              key={action.label}
              accessibilityLabel={action.label}
              accessibilityState={{
                selected: action.label === 'Like' ? liked : undefined,
              }}
              onPress={() => {
                if (action.label === 'Like') {
                  void selectionHaptic()
                  setLiked(value => !value)
                }
              }}
              style={styles.railButton}>
              <AppIcon
                name={action.icon}
                colour={overlayColour}
                size={action.label === 'Like' && liked ? 30 : 26}
              />
              {action.label === 'Like' ? (
                <AppText variant="caption" style={{color: overlayColour}}>
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
    alignItems: 'flex-end',
    flex: 1,
    flexDirection: 'row',
    gap: 16,
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
  feedSwitch: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 18,
  },
  item: {
    overflow: 'hidden',
  },
  rail: {
    gap: 14,
  },
  railButton: {
    alignItems: 'center',
    minHeight: 48,
    minWidth: 48,
    justifyContent: 'center',
  },
  reelButton: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  reelPattern: {
    backgroundColor: 'rgba(0, 0, 0, 0.16)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  screen: {
    flex: 1,
  },
  topRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
})
