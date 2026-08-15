import {useCallback, useEffect, useRef, useState, type ReactNode} from 'react'
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type View as RNView,
} from 'react-native'

import {MaterialSurface} from '@/components/materials/MaterialSurface'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type ModulaPopoverProps = {
  isOpen: boolean
  onDismiss: () => void
  /** The always-rendered anchor content (usually a button). */
  trigger: ReactNode
  children: ReactNode
  /** Preferred width of the popover card. */
  width?: number
  accessibilityLabel?: string
  testID?: string
}

const POPOVER_GAP = 6

/**
 * Anchored popover for contextual surfaces. Floating-role material; Escape
 * dismissal and focus-return on web; backdrop press everywhere. Uses the
 * existing Surface runtime — no new overlay framework.
 */
export function ModulaPopover({
  isOpen,
  onDismiss,
  trigger,
  children,
  width = 280,
  accessibilityLabel,
  testID,
}: ModulaPopoverProps) {
  const anchorRef = useRef<RNView>(null)
  const {height: windowHeight, width: windowWidth} = useWindowDimensions()
  const [anchorFrame, setAnchorFrame] = useState<{
    x: number
    y: number
    width: number
    height: number
  } | null>(null)
  const {spacing} = useThemeTokens()

  const measureAnchor = useCallback(() => {
    anchorRef.current?.measureInWindow((x, y, w, h) => {
      setAnchorFrame({x, y, width: w, height: h})
    })
  }, [])

  useEffect(() => {
    if (isOpen) measureAnchor()
  }, [isOpen, measureAnchor])

  useEffect(() => {
    if (!isOpen || Platform.OS !== 'web') return
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDismiss()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isOpen, onDismiss])

  const left = anchorFrame
    ? Math.max(
        8,
        Math.min(anchorFrame.x, windowWidth - width - 8),
      )
    : 0
  const openBelow = anchorFrame
    ? anchorFrame.y + anchorFrame.height + POPOVER_GAP + 200 < windowHeight
    : true
  const top = anchorFrame
    ? openBelow
      ? anchorFrame.y + anchorFrame.height + POPOVER_GAP
      : undefined
    : 0
  const bottom = anchorFrame && !openBelow
    ? windowHeight - anchorFrame.y + POPOVER_GAP
    : undefined

  return (
    <>
      <View ref={anchorRef} collapsable={false}>
        {trigger}
      </View>
      <Modal
        visible={isOpen}
        transparent
        animationType="none"
        onRequestClose={onDismiss}>
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityLabel="Dismiss popover"
          onPress={onDismiss}
        />
        {anchorFrame ? (
          <View
            accessibilityViewIsModal
            accessibilityLabel={accessibilityLabel}
            testID={testID}
            style={[styles.card, {left, top, bottom, width}]}>
            <MaterialSurface role="floating" style={{padding: spacing[3]}}>
              {children}
            </MaterialSurface>
          </View>
        ) : null}
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
  },
})
