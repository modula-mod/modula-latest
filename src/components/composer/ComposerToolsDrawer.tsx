import {useEffect, useState} from 'react'
import {Animated, Modal, Pressable, StyleSheet, View} from 'react-native'
import {useSafeAreaInsets} from 'react-native-safe-area-context'

import {MaterialSurface} from '@/components/materials/MaterialSurface'
import {AppIcon, type AppIconName} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {useReduceMotion} from '@/lib/accessibility'
import {
  sheetKeyboardBottomInset,
  useKeyboardHeight,
} from '@/platform/ui/keyboard'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type ComposerToolsDrawerProps = {
  visible: boolean
  onClose: () => void
  onPhoto: () => void
  onCamera: () => void
  onInsertLink: () => void
  onInsertPoll: () => void
  onPlaceholder: (toolName: string) => void
}

type ToolItem = {
  label: string
  icon: AppIconName
  onPress: () => void
}

/**
 * Composer Tools sheet (RN Modal bridge).
 * Phase 4.5 may replace the shell with Modula BottomSheet; keyboard inset
 * helpers remain useful either way.
 */
export function ComposerToolsDrawer({
  visible,
  onClose,
  onPhoto,
  onCamera,
  onInsertLink,
  onInsertPoll,
  onPlaceholder,
}: ComposerToolsDrawerProps) {
  const insets = useSafeAreaInsets()
  const keyboardHeight = useKeyboardHeight()
  const reduceMotion = useReduceMotion()
  const [progress] = useState(() => new Animated.Value(0))
  const {colours, motion, radius, spacing} = useThemeTokens()

  useEffect(() => {
    progress.stopAnimation()
    const duration = reduceMotion ? 0 : visible ? motion.normal : motion.fast
    Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration,
      useNativeDriver: true,
    }).start()
  }, [motion.fast, motion.normal, progress, reduceMotion, visible])

  useEffect(() => {
    return () => progress.stopAnimation()
  }, [progress])

  const tools: ToolItem[] = [
    {label: 'Photo', icon: 'photo', onPress: onPhoto},
    {label: 'Camera', icon: 'camera', onPress: onCamera},
    {label: 'GIF', icon: 'gif', onPress: () => onPlaceholder('GIF')},
    {label: 'Poll', icon: 'poll', onPress: onInsertPoll},
    {label: 'Link', icon: 'link', onPress: onInsertLink},
    {label: 'Event', icon: 'event', onPress: () => onPlaceholder('Event')},
    {
      label: 'Automation',
      icon: 'automation',
      onPress: () => onPlaceholder('Automation'),
    },
    {
      label: 'Browse tools',
      icon: 'tools',
      onPress: () => onPlaceholder('Browse tools'),
    },
  ]

  const bottomPad = sheetKeyboardBottomInset(keyboardHeight, insets.bottom, spacing[4])

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}>
      <View style={StyleSheet.absoluteFill}>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              opacity: progress,
              backgroundColor: colours.backdrop,
            },
          ]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close Composer Tools"
            onPress={onClose}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
        <Animated.View
          style={[
            styles.sheetFrame,
            {
              transform: [
                {
                  translateY: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [320, 0],
                  }),
                },
              ],
            },
          ]}>
          <MaterialSurface
            role="modal"
            style={[
              styles.sheet,
              {
                borderTopColor: colours.border,
                borderTopLeftRadius: radius.xlarge,
                borderTopRightRadius: radius.xlarge,
                paddingBottom: bottomPad,
              },
            ]}>
            <View style={[styles.handle, {backgroundColor: colours.border}]} />
            <View style={[styles.header, {paddingHorizontal: spacing[4]}]}>
              <AppText variant="headline">Composer Tools</AppText>
              <AppPressable
                accessibilityLabel="Close Composer Tools"
                onPress={onClose}
                style={styles.close}>
                <AppIcon name="close" colour={colours.textSecondary} />
              </AppPressable>
            </View>
            <View style={[styles.grid, {paddingHorizontal: spacing[4]}]}>
              {tools.map(tool => (
                <AppPressable
                  key={tool.label}
                  accessibilityLabel={tool.label}
                  onPress={() => {
                    tool.onPress()
                    onClose()
                  }}
                  style={[
                    styles.tool,
                    {
                      backgroundColor: colours.surfaceRaised,
                      borderColor: colours.border,
                      borderRadius: radius.medium,
                    },
                  ]}>
                  <AppIcon name={tool.icon} colour={colours.accent} />
                  <AppText variant="label" numberOfLines={1}>
                    {tool.label}
                  </AppText>
                </AppPressable>
              ))}
            </View>
          </MaterialSurface>
        </Animated.View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  close: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  handle: {
    alignSelf: 'center',
    height: 4,
    marginTop: 10,
    width: 38,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  sheet: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 4,
  },
  sheetFrame: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  tool: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flexBasis: '23%',
    gap: 8,
    minHeight: 92,
    minWidth: 76,
    justifyContent: 'center',
    padding: 10,
  },
})
