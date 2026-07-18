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
  if (tool.toolId.includes('gif')) return 'gif'
  if (tool.toolId.includes('photo') || tool.toolId.includes('video')) return 'photo'
  if (tool.toolId.includes('file')) return 'storage'
  if (tool.toolId.includes('poll')) return 'poll'
  if (tool.toolId.includes('location')) return 'link'
  if (tool.toolId.includes('schedule')) return 'event'
  if (tool.toolId.includes('warning')) return 'warning'
  if (tool.toolId.includes('nft')) return 'security'
  if (tool.toolId.includes('product')) return 'marketplace'
  if (tool.toolId.includes('translate')) return 'text'
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
    if (tool.availability === 'unavailable') {
      const title = tool.requiresModule ? `Requires ${tool.requiresModule}` : 'Tool unavailable'
      const message =
        tool.description ??
        (tool.requiresModule
          ? `${tool.name} needs the ${tool.requiresModule} module.`
          : `${tool.name} is not available in this Preview.`)
      Alert.alert(title, message)
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
        <View style={{gap: spacing[1]}}>
          <AppText variant="headline">Composer Tools</AppText>
          <AppText variant="caption" colour="textSecondary">
            Media, create, modules, and agents — honest Preview / Requires module states.
          </AppText>
        </View>
        {invocationState !== 'idle' ? (
          <View
            style={[
              styles.status,
              {
                backgroundColor: colours.accentSubtle,
                borderColor: colours.accentBorder,
                borderRadius: radius.medium,
                padding: spacing[3],
              },
            ]}>
            <AppText variant="caption" colour="accent">
              Function: {invocationState}
              {invocationMessage ? ` · ${invocationMessage}` : ''}
            </AppText>
          </View>
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
                  const preview = tool.availability === 'preview'
                  const unavailable = tool.availability === 'unavailable'
                  const label = tool.requiresModule
                    ? `${tool.name} · Requires ${tool.requiresModule}`
                    : preview
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
                          backgroundColor: unavailable
                            ? colours.surfaceMuted
                            : preview
                              ? colours.accentSubtle
                              : colours.surface,
                          borderColor: unavailable
                            ? colours.border
                            : preview
                              ? colours.accentBorder
                              : colours.border,
                          borderRadius: radius.medium,
                          padding: spacing[3],
                          gap: spacing[2],
                          opacity: unavailable ? 0.7 : 1,
                        },
                      ]}>
                      <AppIcon name={iconFor(tool)} colour={colours.accent} size={22} />
                      <AppText variant="caption">{tool.name}</AppText>
                      <AppText variant="micro" colour="textTertiary">
                        {unavailable
                          ? `Requires ${tool.requiresModule ?? 'module'}`
                          : preview
                            ? 'Preview'
                            : tool.section}
                      </AppText>
                      {tool.description ? (
                        <AppText variant="micro" colour="textSecondary" numberOfLines={2}>
                          {tool.description}
                        </AppText>
                      ) : null}
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
    borderWidth: StyleSheet.hairlineWidth,
    flexGrow: 1,
    minHeight: 96,
    minWidth: '46%',
  },
  status: {
    borderWidth: StyleSheet.hairlineWidth,
  },
})
