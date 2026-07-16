import {BottomSheet} from '@expo/ui'
import type {ReactNode} from 'react'
import {StyleSheet, View} from 'react-native'

import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type ModulaSheetProps = {
  isPresented: boolean
  onDismiss: () => void
  children: ReactNode
  /** Medium + large detents by default for Tools / account panel. */
  snapPoints?: ('half' | 'full' | {fraction: number} | {height: number})[]
  showDragIndicator?: boolean
  testID?: string
}

/**
 * Native sheet via `@expo/ui` universal BottomSheet.
 * Product screens consume ModulaSheet — never BottomSheet directly.
 */
export function ModulaSheet({
  isPresented,
  onDismiss,
  children,
  snapPoints = ['half', 'full'],
  showDragIndicator = true,
  testID,
}: ModulaSheetProps) {
  const {colours, spacing} = useThemeTokens()

  return (
    <BottomSheet
      isPresented={isPresented}
      onDismiss={onDismiss}
      showDragIndicator={showDragIndicator}
      snapPoints={snapPoints}
      testID={testID}>
      <View style={[styles.body, {backgroundColor: colours.surface, padding: spacing[4]}]}>
        {children}
      </View>
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
  },
})
