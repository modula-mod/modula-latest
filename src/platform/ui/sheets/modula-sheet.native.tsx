import {BottomSheet} from '@expo/ui'
import {containerRelativeFrame, frame} from '@expo/ui/swift-ui/modifiers'
import {BlurView} from 'expo-blur'
import {Platform, StyleSheet, View, useWindowDimensions} from 'react-native'

import type {ModulaSheetProps} from '@/platform/ui/sheets/modula-sheet.types'
import {useSystemAccessibility} from '@/theme/accessibility/useSystemAccessibility'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type {ModulaSheetProps} from '@/platform/ui/sheets/modula-sheet.types'

/**
 * Native sheet via `@expo/ui` universal BottomSheet.
 * Forces full-width content — Expo's SwiftUI Host defaults to topLeading
 * intrinsic sizing, which otherwise shrink-wraps rows to ~44pt and letter-wraps labels.
 */
export function ModulaSheet({
  isPresented,
  onDismiss,
  children,
  snapPoints = ['half', 'full'],
  showDragIndicator = true,
  testID,
  material = 'glass',
}: ModulaSheetProps) {
  const {colours, spacing, scheme} = useThemeTokens()
  const {width: windowWidth} = useWindowDimensions()
  const {reduceTransparency} = useSystemAccessibility()
  const useGlass =
    material === 'glass' &&
    !reduceTransparency &&
    Platform.OS === 'ios'

  // Expo BottomSheet applies 16pt leading/trailing padding; keep content ≥ usable width.
  const contentWidth = Math.max(280, windowWidth - 32)

  return (
    <BottomSheet
      isPresented={isPresented}
      onDismiss={onDismiss}
      showDragIndicator={showDragIndicator}
      snapPoints={snapPoints}
      testID={testID}
      modifiers={[
        containerRelativeFrame({axes: 'horizontal', alignment: 'topLeading'}),
        frame({
          minWidth: contentWidth,
          maxWidth: Infinity,
          alignment: 'topLeading',
        }),
      ]}>
      {useGlass ? (
        <BlurView
          intensity={48}
          tint={scheme === 'dark' ? 'dark' : 'light'}
          style={[
            styles.body,
            {
              padding: spacing[4],
              width: contentWidth,
              minWidth: contentWidth,
            },
          ]}>
          <View
            style={[
              StyleSheet.absoluteFill,
              {backgroundColor: colours.surface, opacity: 0.55},
            ]}
          />
          <View style={[styles.content, {width: '100%', minWidth: '100%'}]}>{children}</View>
        </BlurView>
      ) : (
        <View
          style={[
            styles.body,
            {
              backgroundColor: colours.surface,
              padding: spacing[4],
              width: contentWidth,
              minWidth: contentWidth,
            },
          ]}>
          <View style={[styles.content, {width: '100%', minWidth: '100%'}]}>{children}</View>
        </View>
      )}
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  body: {
    alignSelf: 'stretch',
    flex: 1,
    overflow: 'hidden',
  },
  content: {
    alignSelf: 'stretch',
    flex: 1,
    zIndex: 1,
  },
})
