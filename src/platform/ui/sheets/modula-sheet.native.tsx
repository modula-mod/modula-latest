import {BottomSheet} from '@expo/ui'
import {BlurView} from 'expo-blur'
import type {ReactNode} from 'react'
import {Platform, StyleSheet, View} from 'react-native'

import {useSystemAccessibility} from '@/theme/accessibility/useSystemAccessibility'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type ModulaSheetProps = {
  isPresented: boolean
  onDismiss: () => void
  children: ReactNode
  /** Medium + large detents by default for Tools / account panel. */
  snapPoints?: ('half' | 'full' | {fraction: number} | {height: number})[]
  showDragIndicator?: boolean
  testID?: string
  /** Prefer glass material when Reduce Transparency is off. */
  material?: 'solid' | 'glass'
}

/**
 * Native sheet via `@expo/ui` universal BottomSheet.
 * On iOS that adapter hosts SwiftUI BottomSheet (detents + grabber + isPresented).
 * Product screens consume ModulaSheet — never BottomSheet / `@expo/ui/swift-ui` directly.
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
  const {reduceTransparency} = useSystemAccessibility()
  const useGlass =
    material === 'glass' &&
    !reduceTransparency &&
    Platform.OS === 'ios'

  return (
    <BottomSheet
      isPresented={isPresented}
      onDismiss={onDismiss}
      showDragIndicator={showDragIndicator}
      snapPoints={snapPoints}
      testID={testID}>
      {useGlass ? (
        <BlurView
          intensity={48}
          tint={scheme === 'dark' ? 'dark' : 'light'}
          style={[styles.body, {padding: spacing[4]}]}>
          <View
            style={[
              StyleSheet.absoluteFill,
              {backgroundColor: colours.surface, opacity: 0.55},
            ]}
          />
          <View style={styles.content}>{children}</View>
        </BlurView>
      ) : (
        <View style={[styles.body, {backgroundColor: colours.surface, padding: spacing[4]}]}>
          {children}
        </View>
      )}
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    zIndex: 1,
  },
})
