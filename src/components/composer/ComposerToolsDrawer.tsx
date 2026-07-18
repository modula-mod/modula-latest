import {useEffect, useMemo, useState} from 'react'
import {Alert, ScrollView, StyleSheet, View} from 'react-native'
import {useSafeAreaInsets} from 'react-native-safe-area-context'

import {AppIcon, type AppIconName} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import type {ComposerToolItem, ComposerToolSection, FunctionInvocationState} from '@/data/repositories/contracts'
import {
  keyboardScrollProps,
  sheetKeyboardBottomInset,
  useKeyboardHeight,
} from '@/platform/ui/keyboard'
import {ModulaSheet} from '@/platform/ui/sheets/modula-sheet'
import {useAppServices} from '@/runtime/useAppServices'
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

const SECTIONS: ComposerToolSection[] = [
  'Media',
  'Create',
  'Productivity',
  'Automation',
  'AI',
  'Modules',
  'Marketplace',
]

function iconFor(tool: ComposerToolItem): AppIconName {
  if (tool.toolId.includes('camera')) return 'camera'
  if (tool.toolId.includes('photo') || tool.toolId.includes('gif')) return 'photo'
  if (tool.toolId.includes('poll')) return 'poll'
  if (tool.toolId.includes('link')) return 'link'
  if (tool.toolId.includes('market')) return 'marketplace'
  if (tool.toolId.includes('automation')) return 'automation'
  if (tool.section === 'Modules') return 'modules'
  if (tool.section === 'AI') return 'tools'
  return 'tools'
}

/**
 * Composer Tools via ModulaSheet (Expo UI BottomSheet on native).
 * Loads tools from the Greenfield registry with built-in fallback.
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
  const services = useAppServices()
  const [tools, setTools] = useState<ComposerToolItem[]>([])
  const [invocationState, setInvocationState] = useState<FunctionInvocationState>('idle')
  const [invocationMessage, setInvocationMessage] = useState<string | null>(null)
  const bottomPad = sheetKeyboardBottomInset(keyboardHeight, insets.bottom, spacing[4])

  useEffect(() => {
    if (!visible) return
    let active = true
    void services.toolsRepository.listComposerTools().then(items => {
      if (active) setTools(items)
    })
    return () => {
      active = false
    }
  }, [services.toolsRepository, visible])

  const sections = useMemo(
    () => SECTIONS.filter(section => tools.some(tool => tool.section === section)),
    [tools],
  )

  const runTool = (tool: ComposerToolItem) => {
    if (tool.requiresModule && tool.availability === 'unavailable') {
      Alert.alert(`Requires ${tool.requiresModule}`, `${tool.name} needs the ${tool.requiresModule} module.`)
      return
    }
    if (tool.toolId.includes('photo')) {
      onPhoto()
      return
    }
    if (tool.toolId.includes('camera')) {
      onCamera()
      return
    }
    if (tool.toolId.includes('link')) {
      onInsertLink()
      return
    }
    if (tool.toolId.includes('poll')) {
      onInsertPoll()
      return
    }
    if (tool.toolId.includes('market')) {
      onClose()
      onBrowseMarketplace()
      return
    }
    setInvocationState('validating')
    setInvocationMessage(`Validating ${tool.name}…`)
    void (async () => {
      setInvocationState('running')
      const result = await services.toolsRepository.invokeFunction(tool.toolId, {})
      setInvocationState(result.state)
      if (result.jobId) {
        setInvocationMessage(`Queued as job ${result.jobId}. Composer stays usable.`)
        return
      }
      if (result.state === 'failed') {
        setInvocationMessage(result.message ?? 'Failed')
        onPlaceholder(tool.name)
        return
      }
      setInvocationMessage(result.message ?? 'Completed')
      onPlaceholder(tool.name)
    })()
  }

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
        {invocationState !== 'idle' ? (
          <AppText variant="caption" colour="textSecondary">
            Function: {invocationState}
            {invocationMessage ? ` · ${invocationMessage}` : ''}
          </AppText>
        ) : null}
        {sections.map(section => (
          <View key={section} style={{gap: spacing[2]}}>
            <AppText variant="label" colour="textSecondary">
              {section}
            </AppText>
            <View style={[styles.grid, {gap: spacing[2]}]}>
              {tools
                .filter(tool => tool.section === section)
                .map(tool => {
                  const label = tool.requiresModule
                    ? `${tool.name} · Requires ${tool.requiresModule}`
                    : tool.availability === 'preview'
                      ? `${tool.name} — Preview`
                      : tool.name
                  return (
                    <AppPressable
                      key={tool.toolId}
                      accessibilityLabel={label}
                      onPress={() => runTool(tool)}
                      style={[
                        styles.tool,
                        {
                          backgroundColor: colours.surfaceMuted,
                          borderRadius: radius.medium,
                          padding: spacing[3],
                          gap: spacing[2],
                          opacity: tool.availability === 'unavailable' ? 0.7 : 1,
                        },
                      ]}>
                      <AppIcon name={iconFor(tool)} colour={colours.accent} size={22} />
                      <AppText variant="caption">{label}</AppText>
                    </AppPressable>
                  )
                })}
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
    minWidth: '46%',
    flexGrow: 1,
  },
})
