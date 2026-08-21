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
import {ModulaIcon} from '@/platform/ui/icons'
import {ModulaReelPlayer} from '@/platform/ui/video/modula-reel-player'
import {LAYERS} from '@/theme/tokens/layers'
import {scrimColour} from '@/theme/tokens/scrim'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type ProductPreviewFrame = {
  id: string
  type: 'image' | 'video'
  headline: string
  accessibilityLabel: string
  source: ImageSource | number | string
  posterSource?: ImageSource | number | string
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
  const [loaded, setLoaded] = useState<Record<string, boolean>>({})
  const [failed, setFailed] = useState<Record<string, boolean>>({})
  const cardWidth = Math.min(286, Math.max(224, Math.round(width * (width >= 720 ? 0.3 : 0.72))))
  const gap = spacing[3]
  const open = frames.find(frame => frame.id === openId) ?? null

  if (!frames.length) {
    return (
      <View style={{gap: spacing[3]}} testID="product-preview-carousel">
        <AppText variant="sectionTitle" accessibilityRole="header">Preview</AppText>
        <View
          accessibilityLabel={`${productName} screenshots are not available for this release`}
          style={[
            styles.empty,
            {
              borderColor: colours.separator,
              gap: spacing[3],
              paddingVertical: spacing[4],
            },
          ]}>
          <ModulaIcon name="module" size={20} colour={colours.textTertiary} />
          <View style={{flex: 1, gap: spacing[1]}}>
            <AppText variant="label">Screenshots not available</AppText>
            <AppText variant="caption" colour="textSecondary">
              This registry release does not include verified product preview media yet.
            </AppText>
          </View>
        </View>
      </View>
    )
  }

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
        <AppText variant="sectionTitle" accessibilityRole="header">Preview</AppText>
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
        {frames.map(frame => {
          const mediaSource = frame.type === 'video' ? frame.posterSource : frame.source
          return (
            <AppPressable
              key={frame.id}
              accessibilityLabel={`${frame.accessibilityLabel}. Open ${frame.type} preview`}
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
              <AppText variant="sectionTitle" style={styles.headline}>{frame.headline}</AppText>
              {mediaSource ? (
                <View style={styles.image}>
                  <AppImage
                    accessibilityLabel={frame.accessibilityLabel}
                    source={mediaSource}
                    contentFit="cover"
                    contentPosition="top"
                    onLoad={() => setLoaded(current => ({...current, [frame.id]: true}))}
                    onError={() => setFailed(current => ({...current, [frame.id]: true}))}
                    transition={reduceMotion ? 0 : 120}
                    style={StyleSheet.absoluteFill}
                  />
                  {!loaded[frame.id] && !failed[frame.id] ? (
                    <View accessibilityLabel="Loading preview" style={[styles.mediaState, {backgroundColor: colours.surfaceRaised}]}>
                      <AppText variant="caption" colour="textTertiary">Loading…</AppText>
                    </View>
                  ) : null}
                  {failed[frame.id] ? (
                    <View accessibilityLabel="Preview failed to load" style={[styles.mediaState, {backgroundColor: colours.surfaceRaised}]}>
                      <ModulaIcon name="module" size={20} colour={colours.textTertiary} />
                      <AppText variant="caption" colour="textSecondary">Preview unavailable</AppText>
                    </View>
                  ) : null}
                  {frame.type === 'video' ? (
                    <View accessibilityElementsHidden style={styles.videoBadge}>
                      <AppText variant="label" style={{color: '#fff'}}>▶</AppText>
                    </View>
                  ) : null}
                </View>
              ) : (
                <View accessibilityLabel="Video poster not available" style={[styles.image, styles.mediaState, {backgroundColor: colours.surfaceRaised}]}>
                  <AppText variant="caption" colour="textSecondary">Video preview</AppText>
                </View>
              )}
            </AppPressable>
          )
        })}
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
              {open.type === 'video' && typeof open.source === 'string' ? (
                <View accessibilityLabel={open.accessibilityLabel} style={styles.viewerImage}>
                  <ModulaReelPlayer sourceUri={open.source} active style={StyleSheet.absoluteFill} />
                </View>
              ) : (
                <AppImage
                  accessibilityLabel={open.accessibilityLabel}
                  source={open.source}
                  contentFit="contain"
                  contentPosition="top"
                  style={styles.viewerImage}
                />
              )}
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
  empty: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
  },
  headingRow: {alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between'},
  headline: {minHeight: 62, paddingHorizontal: 18, textAlign: 'center'},
  image: {flex: 1, minHeight: 348, width: '100%'},
  indicator: {borderRadius: 4, height: 5},
  indicatorRow: {alignItems: 'center', alignSelf: 'center', flexDirection: 'row', gap: 6, minHeight: 16},
  lightbox: {alignItems: 'center', flex: 1, justifyContent: 'center', padding: 20},
  mediaState: {alignItems: 'center', gap: 8, justifyContent: 'center'},
  viewer: {gap: 12, maxWidth: 640, width: '100%'},
  viewerHeader: {alignItems: 'center', flexDirection: 'row', gap: 12},
  viewerImage: {minHeight: 420, width: '100%'},
  viewerTitle: {flex: 1, minWidth: 0},
  videoBadge: {alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.58)', borderRadius: 24, height: 48, justifyContent: 'center', left: '50%', marginLeft: -24, marginTop: -24, position: 'absolute', top: '50%', width: 48},
  webControls: {alignItems: 'center', flexDirection: 'row', gap: 6},
})
