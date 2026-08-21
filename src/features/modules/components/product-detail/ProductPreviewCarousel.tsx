import {useRef, useState} from 'react'
import type {ImageSource} from 'expo-image'
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native'

import {AppImage} from '@/components/primitives/AppImage'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {useReduceMotion} from '@/lib/accessibility'
import {ModulaIconButton} from '@/platform/ui/buttons/modula-icon-button'
import {LAYERS} from '@/theme/tokens/layers'
import {scrimColour} from '@/theme/tokens/scrim'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type ProductPreviewFrame = {
  id: string
  headline: string
  accessibilityLabel: string
  source: ImageSource | number | string
}

export function ProductPreviewCarousel({
  productName,
  frames,
}: {
  productName: string
  frames: ProductPreviewFrame[]
}) {
  const {width, height} = useWindowDimensions()
  const {colours, radius, spacing, resolvedColourMode} = useThemeTokens()
  const reduceMotion = useReduceMotion()
  const scrollRef = useRef<ScrollView>(null)
  const [page, setPage] = useState(0)
  const [openId, setOpenId] = useState<string | null>(null)
  const cardWidth = Math.min(286, Math.max(224, Math.round(width * (width >= 720 ? 0.3 : 0.72))))
  const gap = spacing[3]
  const open = frames.find(frame => frame.id === openId) ?? null

  if (!frames.length) return null

  const move = (direction: -1 | 1) => {
    const next = Math.min(frames.length - 1, Math.max(0, page + direction))
    setPage(next)
    scrollRef.current?.scrollTo({x: next * (cardWidth + gap), animated: !reduceMotion})
  }

  const onMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(event.nativeEvent.contentOffset.x / (cardWidth + gap))
    setPage(Math.min(frames.length - 1, Math.max(0, next)))
  }

  return (
    <View style={{gap: spacing[3]}} testID="product-preview-carousel">
      <View style={styles.headingRow}>
        <AppText variant="headline" accessibilityRole="header">Preview</AppText>
        {Platform.OS === 'web' ? (
          <View style={styles.webControls}>
            <ModulaIconButton
              icon="back"
              accessibilityLabel="Previous preview"
              disabled={page === 0}
              onPress={() => move(-1)}
            />
            <ModulaIconButton
              icon="chevronRight"
              accessibilityLabel="Next preview"
              disabled={page === frames.length - 1}
              onPress={() => move(1)}
            />
          </View>
        ) : null}
      </View>
      <ScrollView
        ref={scrollRef}
        horizontal
        decelerationRate="fast"
        onMomentumScrollEnd={onMomentumEnd}
        showsHorizontalScrollIndicator={false}
        snapToInterval={cardWidth + gap}
        snapToAlignment="start"
        contentContainerStyle={{gap, paddingRight: spacing[5]}}>
        {frames.map(frame => (
          <AppPressable
            key={frame.id}
            accessibilityLabel={`${frame.accessibilityLabel}. Open preview`}
            onPress={() => setOpenId(frame.id)}
            style={[
              styles.card,
              {
                backgroundColor: colours.surface,
                borderColor: colours.border,
                borderRadius: radius.xlarge,
                width: cardWidth,
              },
            ]}>
            <AppText variant="headline" style={styles.headline}>{frame.headline}</AppText>
            <AppImage
              accessibilityLabel={frame.accessibilityLabel}
              source={frame.source}
              contentFit="cover"
              contentPosition="top"
              transition={reduceMotion ? 0 : 120}
              style={styles.image}
            />
          </AppPressable>
        ))}
      </ScrollView>
      <View accessibilityLabel={`Preview ${page + 1} of ${frames.length}`} style={styles.indicatorRow}>
        {frames.map((frame, index) => (
          <View
            key={frame.id}
            accessibilityElementsHidden
            style={[
              styles.indicator,
              {
                backgroundColor: index === page ? colours.accent : colours.separator,
                width: index === page ? 24 : 8,
              },
            ]}
          />
        ))}
      </View>

      <Modal
        visible={Boolean(open)}
        transparent
        animationType={reduceMotion ? 'fade' : 'slide'}
        onRequestClose={() => setOpenId(null)}>
        <View style={[styles.lightbox, {zIndex: LAYERS.dialog}]}>
          <Pressable
            accessibilityLabel="Close preview"
            onPress={() => setOpenId(null)}
            style={[StyleSheet.absoluteFill, {backgroundColor: scrimColour(resolvedColourMode)}]}
          />
          {open ? (
            <View
              accessibilityLabel={`${productName} preview viewer`}
              accessibilityViewIsModal
              style={[
                styles.viewer,
                {
                  backgroundColor: colours.surface,
                  borderRadius: radius.xlarge,
                  maxHeight: height - spacing[10],
                  padding: spacing[3],
                },
              ]}>
              <View style={styles.viewerHeader}>
                <AppText variant="headline" style={styles.viewerTitle}>{open.headline}</AppText>
                <ModulaIconButton icon="close" accessibilityLabel="Close preview" onPress={() => setOpenId(null)} />
              </View>
              <AppImage
                accessibilityLabel={open.accessibilityLabel}
                source={open.source}
                contentFit="contain"
                contentPosition="top"
                style={styles.viewerImage}
              />
            </View>
          ) : null}
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 430,
    overflow: 'hidden',
    paddingTop: 18,
  },
  headingRow: {alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between'},
  headline: {minHeight: 62, paddingHorizontal: 18, textAlign: 'center'},
  image: {flex: 1, minHeight: 348, width: '100%'},
  indicator: {borderRadius: 4, height: 5},
  indicatorRow: {alignItems: 'center', alignSelf: 'center', flexDirection: 'row', gap: 6, minHeight: 16},
  lightbox: {alignItems: 'center', flex: 1, justifyContent: 'center', padding: 20},
  viewer: {gap: 12, maxWidth: 640, width: '100%'},
  viewerHeader: {alignItems: 'center', flexDirection: 'row', gap: 12},
  viewerImage: {minHeight: 420, width: '100%'},
  viewerTitle: {flex: 1, minWidth: 0},
  webControls: {alignItems: 'center', flexDirection: 'row', gap: 6},
})
