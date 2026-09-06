import {useEffect} from 'react'
import {BottomSheet} from '@expo/ui'
import {containerRelativeFrame, frame} from '@expo/ui/swift-ui/modifiers'
import {BlurView} from 'expo-blur'
import {Modal, Platform, Pressable, StyleSheet, View, useWindowDimensions} from 'react-native'

import {useReduceMotion} from '@/lib/accessibility'
import {ModulaSheetLayout} from '@/platform/ui/sheets/modula-sheet-layout'
import {ModulaSheetHeader} from '@/platform/ui/sheets/modula-sheet-header'
import {
  detentForPresentation,
  nativeSnapPoints,
  snapPointsForDetent,
  snapPointsForSemanticDetents,
  type ModulaSheetProps,
} from '@/platform/ui/sheets/modula-sheet.types'
import {setShellChromeHoldObscure} from '@/platform/ui/navigation/shell-chrome-obscure'
import {useSystemAccessibility} from '@/theme/accessibility/useSystemAccessibility'
import {LAYERS} from '@/theme/tokens/layers'
import {scrimColour} from '@/theme/tokens/scrim'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type {ModulaSheetProps} from '@/platform/ui/sheets/modula-sheet.types'

/**
 * One sheet primitive.
 *
 * Structured header/footer sheets (install, composer tools) present as an RN
 * Modal so footer CTAs receive touches. Simple sheets keep Expo BottomSheet
 * with `'half' | 'full'` snap points only.
 */
export function ModulaSheet({
  isPresented,
  onDismiss,
  children,
  presentation,
  title,
  subtitle,
  header,
  footer,
  detent,
  detents,
  snapPoints,
  showDragIndicator = true,
  testID,
  material = 'glass',
  scrollBody = true,
  obscureShellChrome = true,
  accessibilityLabel,
}: ModulaSheetProps) {
  const {colours, spacing, radius, scheme, resolvedColourMode} = useThemeTokens()
  const {width: windowWidth, height: windowHeight, fontScale} = useWindowDimensions()
  const {reduceTransparency} = useSystemAccessibility()
  const reduceMotion = useReduceMotion()
  const useGlass = material === 'glass' && !reduceTransparency && Platform.OS === 'ios'
  const contentWidth = Math.max(280, windowWidth - 32)
  const resolvedDetent = detent ?? detentForPresentation(presentation)
  const resolvedHeader = header ?? (title ? <ModulaSheetHeader title={title} subtitle={subtitle} /> : undefined)
  const structured = Boolean(resolvedHeader || footer)
  const resolvedSnapPoints = nativeSnapPoints(
    snapPoints ?? snapPointsForSemanticDetents(detents) ?? snapPointsForDetent(resolvedDetent),
  )
  const needsAccessibilityHeight = structured && fontScale > 1.2
  const maxBody = Math.round(
    windowHeight * (resolvedDetent === 'medium' && !needsAccessibilityHeight ? 0.56 : 0.92),
  )

  useEffect(() => {
    if (!obscureShellChrome) return
    setShellChromeHoldObscure(isPresented)
    return () => setShellChromeHoldObscure(false)
  }, [isPresented, obscureShellChrome])

  const inner = structured ? (
    <ModulaSheetLayout header={resolvedHeader} footer={footer} scrollBody={scrollBody} testID={testID}>
      {children}
    </ModulaSheetLayout>
  ) : (
    children
  )

  if (structured) {
    return (
      <Modal
        visible={isPresented}
        transparent
        animationType={reduceMotion ? 'fade' : 'slide'}
        onRequestClose={onDismiss}
        testID={testID}
        accessibilityViewIsModal>
        <View style={[styles.modalRoot, {zIndex: LAYERS.sheet}]}>
          <Pressable
            accessibilityLabel="Dismiss"
            onPress={onDismiss}
            style={[
              styles.backdrop,
              {backgroundColor: scrimColour(resolvedColourMode, reduceTransparency)},
            ]}
          />
          <View
            accessibilityLabel={accessibilityLabel}
            style={[
              styles.modalSheet,
              {
                backgroundColor: colours.surface,
                padding: spacing[4],
                borderTopLeftRadius: radius.xlarge,
                borderTopRightRadius: radius.xlarge,
                height: maxBody,
                maxHeight: maxBody,
              },
            ]}>
            {showDragIndicator ? (
              <View style={[styles.handle, {backgroundColor: colours.separator}]} />
            ) : null}
            <View style={styles.modalContent}>{inner}</View>
          </View>
        </View>
      </Modal>
    )
  }

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
  backdrop: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  body: {
    alignSelf: 'stretch',
    overflow: 'hidden',
  },
  content: {
    alignSelf: 'stretch',
    minHeight: 0,
    zIndex: 1,
  },
  handle: {
    alignSelf: 'center',
    borderRadius: 2,
    height: 4,
    marginBottom: 10,
    width: 36,
  },
  modalContent: {
    flex: 1,
    minHeight: 0,
    width: '100%',
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    alignSelf: 'stretch',
    maxHeight: '92%',
    width: '100%',
  },
})
