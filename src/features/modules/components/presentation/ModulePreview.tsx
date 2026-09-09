import {useState} from 'react'
import {Modal, Pressable, ScrollView, StyleSheet, View} from 'react-native'
import Svg, {Circle, Path, Rect} from 'react-native-svg'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {moduleArtworkPack} from '@/features/modules/identity/moduleArtwork'
import {useReduceMotion} from '@/lib/accessibility'
import {useHydrationSafeWindowDimensions} from '@/lib/useHydrationSafeWindowDimensions'
import {LAYERS} from '@/theme/tokens/layers'
import {scrimColour} from '@/theme/tokens/scrim'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type ModulePreviewFrame = {
  id: string
  title: string
  caption: string
}

const VAULT_NOTES_PREVIEWS: ModulePreviewFrame[] = [
  {id: 'list', title: 'Notes', caption: 'A quiet list of recent notes and folders.'},
  {id: 'editor', title: 'Editor', caption: 'Write without marketplace chrome.'},
  {id: 'search', title: 'Search', caption: 'Find notes and folders on this account.'},
]

export function previewsForModule(moduleId: string): ModulePreviewFrame[] {
  if (moduleId.includes('vault-notes')) return VAULT_NOTES_PREVIEWS
  return [
    {id: 'home', title: 'Home', caption: 'The module’s primary collection.'},
    {id: 'detail', title: 'Detail', caption: 'A single record, quietly presented.'},
  ]
}

export function ModulePreview({
  moduleId,
  name,
  frames = previewsForModule(moduleId),
}: {
  moduleId: string
  name: string
  frames?: ModulePreviewFrame[]
}) {
  const {colours, radius, spacing, resolvedColourMode} = useThemeTokens()
  const {width} = useHydrationSafeWindowDimensions()
  const reduceMotion = useReduceMotion()
  const [openId, setOpenId] = useState<string | null>(null)
  const cardWidth = Math.min(220, Math.round(width * 0.58))
  const open = frames.find(frame => frame.id === openId) ?? null
  const pack = moduleArtworkPack(moduleId, name)

  return (
    <View style={{gap: spacing[3]}} testID="module-preview">
      <AppText variant="headline">Preview</AppText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap: spacing[3]}}>
        {frames.map(frame => (
          <AppPressable
            key={frame.id}
            accessibilityLabel={`Preview ${frame.title}`}
            onPress={() => setOpenId(frame.id)}
            style={[
              styles.card,
              {
                backgroundColor: colours.surfaceRaised,
                borderRadius: radius.large,
                padding: spacing[4],
                width: cardWidth,
              },
            ]}>
            <PreviewMock frameId={frame.id} paper={pack.palette.paper} ink={pack.palette.ink} wash={pack.palette.wash} />
            <AppText variant="label">{frame.title}</AppText>
            <AppText variant="caption" colour="textSecondary">
              {frame.caption}
            </AppText>
          </AppPressable>
        ))}
      </ScrollView>
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
              style={[
                styles.viewer,
                {backgroundColor: colours.surface, borderRadius: radius.xlarge, padding: spacing[5]},
              ]}>
              <PreviewMock
                frameId={open.id}
                paper={pack.palette.paper}
                ink={pack.palette.ink}
                wash={pack.palette.wash}
                large
              />
              <AppText variant="headline">{open.title}</AppText>
              <AppText variant="body" colour="textSecondary">
                {open.caption}
              </AppText>
              <AppPressable accessibilityLabel="Close preview" onPress={() => setOpenId(null)}>
                <AppText variant="label" colour="accent">
                  Close
                </AppText>
              </AppPressable>
            </View>
          ) : null}
        </View>
      </Modal>
    </View>
  )
}

function PreviewMock({
  frameId,
  paper,
  ink,
  wash,
  large = false,
}: {
  frameId: string
  paper: string
  ink: string
  wash: string
  large?: boolean
}) {
  const width = large ? 180 : 112
  const height = large ? 240 : 148
  return (
    <Svg width={width} height={height} viewBox="0 0 112 148" accessibilityLabel={`${frameId} preview`}>
      <Rect x="6" y="4" width="100" height="140" rx="16" fill={paper} stroke={ink} strokeWidth="1.4" />
      <Rect x="44" y="10" width="24" height="5" rx="2.5" fill={wash} />
      {frameId === 'editor' ? (
        <>
          <Path d="M22 34 H90" stroke={ink} strokeWidth="2" strokeLinecap="round" />
          <Path d="M22 50 H84" stroke={ink} strokeWidth="1.4" opacity="0.45" strokeLinecap="round" />
          <Path d="M22 62 H88" stroke={ink} strokeWidth="1.4" opacity="0.35" strokeLinecap="round" />
          <Path d="M22 74 H70" stroke={ink} strokeWidth="1.4" opacity="0.25" strokeLinecap="round" />
        </>
      ) : frameId === 'search' ? (
        <>
          <Circle cx="34" cy="40" r="10" stroke={ink} strokeWidth="1.6" fill="none" />
          <Path d="M41 47 L50 56" stroke={ink} strokeWidth="1.6" strokeLinecap="round" />
          <Rect x="22" y="72" width="68" height="10" rx="3" fill={wash} />
          <Rect x="22" y="90" width="52" height="10" rx="3" fill={wash} opacity="0.7" />
        </>
      ) : (
        <>
          <Rect x="22" y="32" width="68" height="12" rx="3" fill={wash} />
          <Rect x="22" y="52" width="68" height="12" rx="3" fill={wash} opacity="0.75" />
          <Rect x="22" y="72" width="52" height="12" rx="3" fill={wash} opacity="0.5" />
          <Rect x="22" y="92" width="60" height="12" rx="3" fill={wash} opacity="0.35" />
        </>
      )}
    </Svg>
  )
}

const styles = StyleSheet.create({
  card: {gap: 10, minHeight: 220},
  lightbox: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  viewer: {alignItems: 'center', gap: 12, maxWidth: 420, width: '100%'},
})
