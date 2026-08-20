import {useState} from 'react'
import {NativeScrollEvent, NativeSyntheticEvent, ScrollView, StyleSheet, View} from 'react-native'
import {Image} from 'expo-image'
import {LinearGradient} from 'expo-linear-gradient'

import {AppText} from '@/components/primitives/AppText'
import type {CarouselPostContent} from '@/features/social/posts/types/post'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

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
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={StyleSheet.absoluteFill}>
        {content.items.map(item => (
          <View
            key={item.id}
            style={{
              height: '100%',
              width: width || '100%',
            }}>
            {item.url && !item.url.startsWith('local://') ? (
              <Image source={{uri: item.url}} style={StyleSheet.absoluteFill} contentFit="cover" />
            ) : (
              <LinearGradient
                colors={[item.colour ?? colours.accent, colours.surface3]}
                style={StyleSheet.absoluteFill}
              />
            )}
          </View>
        ))}
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
