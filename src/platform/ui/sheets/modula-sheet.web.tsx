import {useEffect, useRef} from 'react'
import {Modal, Pressable, StyleSheet, View, useWindowDimensions} from 'react-native'

import {ModulaSheetLayout} from '@/platform/ui/sheets/modula-sheet-layout'
import {ModulaSheetHeader} from '@/platform/ui/sheets/modula-sheet-header'
import {detentForPresentation, type ModulaSheetProps} from '@/platform/ui/sheets/modula-sheet.types'
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
  presentation,
  title,
  subtitle,
  header,
  footer,
  detent,
  testID,
  scrollBody = true,
  obscureShellChrome = true,
  accessibilityLabel,
}: ModulaSheetProps) {
  const {colours, spacing, radius, resolvedColourMode} = useThemeTokens()
  const {reduceTransparency} = useSystemAccessibility()
  const {height, width} = useWindowDimensions()
  const sheetRef = useRef<View>(null)
  const resolvedDetent = detent ?? detentForPresentation(presentation)
  const resolvedHeader = header ?? (title ? <ModulaSheetHeader title={title} subtitle={subtitle} /> : undefined)
  const structured = Boolean(resolvedHeader || footer)
  const maxHeight =
    resolvedDetent === 'full' ? height : resolvedDetent === 'large' ? Math.round(height * 0.92) : Math.round(height * 0.56)
  const desktopDialog = width >= 768

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
    <ModulaSheetLayout header={resolvedHeader} footer={footer} scrollBody={scrollBody} testID={testID}>
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
      <View
        style={[
          styles.root,
          {justifyContent: desktopDialog ? 'center' : 'flex-end', zIndex: LAYERS.sheet},
        ]}>
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
              borderBottomLeftRadius: desktopDialog ? radius.lg : 0,
              borderBottomRightRadius: desktopDialog ? radius.lg : 0,
              maxHeight,
              minHeight: resolvedDetent === 'medium' ? 240 : 320,
              maxWidth: desktopDialog ? 560 : undefined,
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
    alignItems: 'center',
    flex: 1,
  },
  sheet: {
    alignSelf: 'stretch',
    width: '100%',
  },
})
