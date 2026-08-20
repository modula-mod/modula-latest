import {useState} from 'react'
import {NativeScrollEvent, NativeSyntheticEvent, ScrollView, StyleSheet, View} from 'react-native'
import {Image} from 'expo-image'
import {LinearGradient} from 'expo-linear-gradient'

import {AppText} from '@/components/primitives/AppText'
import type {CarouselPostContent} from '@/features/social/posts/types/post'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const CONTROLLED_MEDIA_FALLBACKS: Readonly<Record<string, string>> = {
  'media-profile-platform':
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
  'media-profile-tabs':
    'https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=1200&q=80',
}

export function CarouselPostRenderer({content}: {content: CarouselPostContent}) {
  const {colours, spacing} = useThemeTokens()
  const [index, setIndex] = useState(0)
  const [width, setWidth] = useState(0)

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const pageWidth = width || 1
    const next = Math.round(event.nativeEvent.contentOffset.x / pageWidth)
    setIndex(next)
  }

  return (
    <View
      style={StyleSheet.absoluteFill}
      onLayout={event => {
        setWidth(event.nativeEvent.layout.width)
      }}>
      <ScrollView
        horizontal
        pagingEnabled
        testID="post-carousel"
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={StyleSheet.absoluteFill}>
        {content.items.map(item => {
          const controlledUri = CONTROLLED_MEDIA_FALLBACKS[item.id]
          const imageUri =
            item.url && !item.url.startsWith('local://') ? item.url : controlledUri
          return (
            <View
              key={item.id}
              style={{
                height: '100%',
                width: width || '100%',
              }}>
              {imageUri ? (
                <Image source={{uri: imageUri}} style={StyleSheet.absoluteFill} contentFit="cover" />
              ) : (
                <LinearGradient
                  colors={[item.colour ?? colours.accent, colours.surface3]}
                  style={StyleSheet.absoluteFill}
                />
              )}
            </View>
          )
        })}
      </ScrollView>
      <LinearGradient
        colors={['rgba(0,0,0,0.42)', 'transparent']}
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.indicator, {left: spacing[3], bottom: spacing[6]}]}>
        <AppText variant="caption" style={{color: colours.mediaOverlayText}}>
          {index + 1}/{content.items.length}
        </AppText>
        <View style={styles.dots}>
          {content.items.map((item, dotIndex) => (
            <View
              key={item.id}
              style={[
                styles.dot,
                {
                  backgroundColor:
                    dotIndex === index ? colours.mediaOverlayText : colours.mediaOverlaySecondary,
                  opacity: dotIndex === index ? 1 : 0.45,
                  width: dotIndex === index ? 16 : 6,
                },
              ]}
            />
          ))}
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  dot: {
    borderRadius: 999,
    height: 6,
  },
  dots: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  indicator: {
    flexDirection: 'row',
    gap: 8,
    position: 'absolute',
  },
})
