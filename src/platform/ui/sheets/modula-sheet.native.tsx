import {useEffect} from 'react'
import {BottomSheet} from '@expo/ui'
import {containerRelativeFrame, frame} from '@expo/ui/swift-ui/modifiers'
import {BlurView} from 'expo-blur'
import {Platform, StyleSheet, View, useWindowDimensions} from 'react-native'

import {ModulaSheetLayout} from '@/platform/ui/sheets/modula-sheet-layout'
import {
  snapPointsForDetent,
  type ModulaSheetProps,
} from '@/platform/ui/sheets/modula-sheet.types'
import {setShellChromeHoldObscure} from '@/platform/ui/navigation/shell-chrome-obscure'
import {useSystemAccessibility} from '@/theme/accessibility/useSystemAccessibility'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type {ModulaSheetProps} from '@/platform/ui/sheets/modula-sheet.types'

/**
 * Native sheet via `@expo/ui` universal BottomSheet.
 * Actionable workflows use header / scroll body / fixed footer.
 * Forces full-width content — Expo's SwiftUI Host defaults to topLeading
 * intrinsic sizing, which otherwise shrink-wraps rows to ~44pt.
 */
export function ModulaSheet({
  isPresented,
  onDismiss,
  children,
  header,
  footer,
  detent,
  snapPoints,
  showDragIndicator = true,
  testID,
  material = 'glass',
  scrollBody = true,
  obscureShellChrome = true,
  accessibilityLabel,
}: ModulaSheetProps) {
  const {colours, spacing, scheme} = useThemeTokens()
  const {width: windowWidth, height: windowHeight} = useWindowDimensions()
  const {reduceTransparency} = useSystemAccessibility()
  const useGlass = material === 'glass' && !reduceTransparency && Platform.OS === 'ios'
  const contentWidth = Math.max(280, windowWidth - 32)
  const resolvedSnapPoints = snapPoints ?? snapPointsForDetent(detent)
  const structured = Boolean(header || footer)
  const maxBody = Math.round(windowHeight * (detent === 'medium' ? 0.52 : 0.86))

  useEffect(() => {
    if (!obscureShellChrome) return
    setShellChromeHoldObscure(isPresented)
    return () => setShellChromeHoldObscure(false)
  }, [isPresented, obscureShellChrome])

  const inner = structured ? (
    <ModulaSheetLayout header={header} footer={footer} scrollBody={scrollBody} testID={testID}>
      {children}
    </ModulaSheetLayout>
  ) : (
    children
  )

  return (
    <BottomSheet
      isPresented={isPresented}
      onDismiss={onDismiss}
      showDragIndicator={showDragIndicator}
      snapPoints={resolvedSnapPoints}
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
          accessibilityLabel={accessibilityLabel}
          style={[
            styles.body,
            {
              padding: spacing[4],
              width: contentWidth,
              minWidth: contentWidth,
              maxHeight: maxBody,
            },
          ]}>
          <View style={[StyleSheet.absoluteFill, {backgroundColor: colours.surface, opacity: 0.55}]} />
          <View style={[styles.content, {width: '100%', minWidth: '100%'}]}>{inner}</View>
        </BlurView>
      ) : (
        <View
          accessibilityLabel={accessibilityLabel}
          style={[
            styles.body,
            {
              backgroundColor: colours.surface,
              padding: spacing[4],
              width: contentWidth,
              minWidth: contentWidth,
              maxHeight: maxBody,
            },
          ]}>
          <View style={[styles.content, {width: '100%', minWidth: '100%'}]}>{inner}</View>
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
    minHeight: 0,
    zIndex: 1,
  },
})
