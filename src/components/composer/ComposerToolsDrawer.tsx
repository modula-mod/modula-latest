import {ScrollView, StyleSheet, View} from 'react-native'
import {useSafeAreaInsets} from 'react-native-safe-area-context'

import {AppIcon, type AppIconName} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {
  keyboardScrollProps,
  sheetKeyboardBottomInset,
  useKeyboardHeight,
} from '@/platform/ui/keyboard'
import {ModulaSheet} from '@/platform/ui/sheets/modula-sheet'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type ComposerToolsDrawerProps = {
  visible: boolean
  onClose: () => void
  onPhoto: () => void
  onCamera: () => void
  onInsertLink: () => void
  onInsertPoll: () => void
  onBrowseMarketplace: () => void
  onPlaceholder: (toolName: string) => void
}

type ToolItem = {
  label: string
  icon: AppIconName
  section: 'Media' | 'Create' | 'Tools' | 'Marketplace'
  onPress: () => void
}

/**
 * Composer Tools via ModulaSheet (Expo UI BottomSheet on native).
 * Preserves sibling keyboard inset helpers and does not discard the draft.
 */
export function ComposerToolsDrawer({
  visible,
  onClose,
  onPhoto,
  onCamera,
  onInsertLink,
  onInsertPoll,
  onBrowseMarketplace,
  onPlaceholder,
}: ComposerToolsDrawerProps) {
  const insets = useSafeAreaInsets()
  const keyboardHeight = useKeyboardHeight()
  const {colours, radius, spacing} = useThemeTokens()
  const bottomPad = sheetKeyboardBottomInset(keyboardHeight, insets.bottom, spacing[4])

  const tools: ToolItem[] = [
    {section: 'Media', label: 'Photo', icon: 'photo', onPress: onPhoto},
    {section: 'Media', label: 'Camera', icon: 'camera', onPress: onCamera},
    {section: 'Media', label: 'GIF', icon: 'gif', onPress: () => onPlaceholder('GIF')},
    {section: 'Create', label: 'Poll', icon: 'poll', onPress: onInsertPoll},
    {section: 'Create', label: 'Link', icon: 'link', onPress: onInsertLink},
    {
      section: 'Create',
      label: 'Module post',
      icon: 'modules',
      onPress: () => onPlaceholder('Module post'),
    },
    {
      section: 'Tools',
      label: 'Comment to DM — Preview',
      icon: 'messages',
      onPress: () => onPlaceholder('Comment to DM'),
    },
    {
      section: 'Tools',
      label: 'Automation — Preview',
      icon: 'automation',
      onPress: () => onPlaceholder('Automation'),
    },
    {
      section: 'Tools',
      label: 'AI Assist — Preview',
      icon: 'tools',
      onPress: () => onPlaceholder('AI Assist'),
    },
    {
      section: 'Marketplace',
      label: 'Browse tools',
      icon: 'marketplace',
      onPress: () => {
        onClose()
        onBrowseMarketplace()
      },
    },
  ]

  const sections = ['Media', 'Create', 'Tools', 'Marketplace'] as const

  return (
    <ModulaSheet
      isPresented={visible}
      onDismiss={onClose}
      snapPoints={['half', 'full']}
      testID="composer-tools-sheet">
      <ScrollView
        {...keyboardScrollProps}
        contentContainerStyle={{paddingBottom: bottomPad, gap: spacing[4]}}>
        <AppText variant="headline">Composer Tools</AppText>
        {sections.map(section => (
          <View key={section} style={{gap: spacing[2]}}>
            <AppText variant="label" colour="textSecondary">
              {section}
            </AppText>
            <View style={[styles.grid, {gap: spacing[2]}]}>
              {tools
                .filter(tool => tool.section === section)
                .map(tool => (
                  <AppPressable
                    key={tool.label}
                    accessibilityLabel={tool.label}
                    onPress={() => {
                      tool.onPress()
                      // Keep sheet open for media/create until caller closes;
                      // preview placeholders dismiss to reduce clutter.
                      if (tool.label.includes('Preview')) {
                        onClose()
                      }
                    }}
                    style={[
                      styles.tool,
                      {
                        backgroundColor: colours.surfaceRaised,
                        borderColor: colours.border,
                        borderRadius: radius.md,
                      },
                    ]}>
                    <AppIcon name={tool.icon} colour={colours.accent} />
                    <AppText variant="caption" numberOfLines={2} style={styles.toolLabel}>
                      {tool.label}
                    </AppText>
                  </AppPressable>
                ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </ModulaSheet>
  )
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tool: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flexBasis: '30%',
    gap: 8,
    justifyContent: 'center',
    minHeight: 88,
    padding: 10,
  },
  toolLabel: {
    textAlign: 'center',
  },
})
