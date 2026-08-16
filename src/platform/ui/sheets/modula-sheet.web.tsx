import {useEffect, useRef} from 'react'
import {Modal, Pressable, StyleSheet, View, useWindowDimensions} from 'react-native'

import {ModulaSheetLayout} from '@/platform/ui/sheets/modula-sheet-layout'
import type {ModulaSheetProps} from '@/platform/ui/sheets/modula-sheet.types'
import {setShellChromeHoldObscure} from '@/platform/ui/navigation/shell-chrome-obscure'
import {useSystemAccessibility} from '@/theme/accessibility/useSystemAccessibility'
import {LAYERS} from '@/theme/tokens/layers'
import {scrimColour} from '@/theme/tokens/scrim'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type {ModulaSheetProps} from '@/platform/ui/sheets/modula-sheet.types'

/** Accessible web/dialog fallback for ModulaSheet. */
export function ModulaSheet({
  isPresented,
  onDismiss,
  children,
  header,
  footer,
  detent = 'medium',
  testID,
  scrollBody = true,
  obscureShellChrome = true,
  accessibilityLabel,
}: ModulaSheetProps) {
  const {colours, spacing, radius, resolvedColourMode} = useThemeTokens()
  const {reduceTransparency} = useSystemAccessibility()
  const {height} = useWindowDimensions()
  const sheetRef = useRef<View>(null)
  const structured = Boolean(header || footer)
  const maxHeight =
    detent === 'full' ? height : detent === 'large' ? Math.round(height * 0.92) : Math.round(height * 0.56)

  useEffect(() => {
    if (!obscureShellChrome) return
    setShellChromeHoldObscure(isPresented)
    return () => setShellChromeHoldObscure(false)
  }, [isPresented, obscureShellChrome])

  useEffect(() => {
    if (!isPresented || typeof document === 'undefined') return
    const previous = document.activeElement as HTMLElement | null
    const root = sheetRef.current as unknown as HTMLElement | null
    const focusable = root?.querySelector?.<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    )
    focusable?.focus()

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onDismiss()
        return
      }
      if (event.key !== 'Tab' || !root) return
      const nodes = Array.from(
        root.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter(node => !node.hasAttribute('disabled'))
      if (!nodes.length) return
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      const active = document.activeElement
      if (event.shiftKey && active === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      previous?.focus?.()
    }
  }, [isPresented, onDismiss])

  const inner = structured ? (
    <ModulaSheetLayout header={header} footer={footer} scrollBody={scrollBody} testID={testID}>
      {children}
    </ModulaSheetLayout>
  ) : (
    children
  )

  return (
    <Modal
      visible={isPresented}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
      testID={testID}
      accessibilityViewIsModal>
      <View style={[styles.root, {zIndex: LAYERS.sheet}]}>
        <Pressable
          accessibilityLabel="Dismiss"
          onPress={onDismiss}
          style={[
            styles.backdrop,
            {backgroundColor: scrimColour(resolvedColourMode, reduceTransparency)},
          ]}
        />
        <View
          ref={sheetRef}
          accessibilityLabel={accessibilityLabel}
          accessibilityRole="none"
          style={[
            styles.sheet,
            {
              backgroundColor: colours.surface,
              padding: spacing[4],
              borderTopLeftRadius: radius.lg,
              borderTopRightRadius: radius.lg,
              maxHeight,
              minHeight: detent === 'medium' ? 240 : 320,
            },
          ]}>
          {inner}
        </View>
      </View>
    </Modal>
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
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    alignSelf: 'stretch',
    width: '100%',
  },
})
