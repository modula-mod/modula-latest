import {useState} from 'react'
import {Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions} from 'react-native'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {ModuleArtwork} from '@/features/modules/components/ModuleArtwork'
import {useReduceMotion} from '@/lib/accessibility'
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
  const {width} = useWindowDimensions()
  const reduceMotion = useReduceMotion()
  const [openId, setOpenId] = useState<string | null>(null)
  const cardWidth = Math.min(220, Math.round(width * 0.58))
  const open = frames.find(frame => frame.id === openId) ?? null

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
            <ModuleArtwork moduleId={moduleId} name={name} size={56} />
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
              <ModuleArtwork moduleId={moduleId} name={name} size={96} variant="hero" />
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

const styles = StyleSheet.create({
  card: {gap: 10, minHeight: 180},
  lightbox: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  viewer: {alignItems: 'center', gap: 12, maxWidth: 420, width: '100%'},
})
