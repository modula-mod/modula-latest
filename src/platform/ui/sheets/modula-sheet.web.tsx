import type {ReactNode} from 'react'
import {Modal, Pressable, StyleSheet, View} from 'react-native'

import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type ModulaSheetProps = {
  isPresented: boolean
  onDismiss: () => void
  children: ReactNode
  snapPoints?: ('half' | 'full' | {fraction: number} | {height: number})[]
  showDragIndicator?: boolean
  testID?: string
  material?: 'solid' | 'glass'
}

/** Accessible web/dialog fallback for ModulaSheet. */
export function ModulaSheet({
  isPresented,
  onDismiss,
  children,
  testID,
}: ModulaSheetProps) {
  const {colours, spacing, radius} = useThemeTokens()

  return (
    <Modal
      visible={isPresented}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
      testID={testID}>
      <View style={styles.root}>
        <Pressable
          accessibilityLabel="Dismiss"
          onPress={onDismiss}
          style={[styles.backdrop, {backgroundColor: colours.backdrop}]}
        />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colours.surface,
              padding: spacing[4],
              borderTopLeftRadius: radius.lg,
              borderTopRightRadius: radius.lg,
            },
          ]}>
          {children}
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
    maxHeight: '85%',
    minHeight: 240,
    width: '100%',
  },
})
