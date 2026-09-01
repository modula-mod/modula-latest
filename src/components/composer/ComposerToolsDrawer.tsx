import {useEffect, useMemo, useState} from 'react'
import {Alert, StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'
import {useSafeAreaInsets} from 'react-native-safe-area-context'

import {AppIcon, type AppIconName} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import type {ComposerToolItem, ComposerToolSection, FunctionInvocationState} from '@/data/repositories/contracts'
import {sheetKeyboardBottomInset, useKeyboardHeight} from '@/platform/ui/keyboard'
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

function isNftAttach(tool: ComposerToolItem): boolean {
  const key = `${tool.toolId} ${tool.name}`.toLowerCase()
  return key.includes('nft')
}

function isAiRewrite(tool: ComposerToolItem): boolean {
  const key = `${tool.toolId} ${tool.name}`.toLowerCase()
  return key.includes('airewrite') || key.includes('ai rewrite')
}

function unavailableTitle(tool: ComposerToolItem): string {
  if (isComingSoonTool(tool)) return `${tool.name} is Coming Soon`
  if (isAiRewrite(tool)) return 'AI rewrite is unavailable'
  if (isNftAttach(tool)) return 'NFT attach is unavailable'
  return tool.requiresModule ? `Requires ${tool.requiresModule}` : 'Tool unavailable'
}

function isComingSoonTool(tool: ComposerToolItem): boolean {
  const key = `${tool.toolId} ${tool.name} ${tool.description ?? ''}`.toLowerCase()
  return (
    key.includes('coming soon') ||
    tool.toolId.includes('gif') ||
    tool.toolId.includes('poll') ||
    (tool.toolId.includes('link') && !tool.toolId.includes('market'))
  )
}

function availabilitySentence(tool: ComposerToolItem): string {
  if (isComingSoonTool(tool)) return 'Coming Soon'
  if (tool.availability === 'requiresInstall') {
    return tool.requiresModule ? `Install ${tool.requiresModule}` : 'Install required'
  }
  if (tool.availability === 'requiresEnable') {
    return tool.requiresModule ? `Enable ${tool.requiresModule}` : 'Enable required'
  }
  if (tool.availability === 'requiresConfiguration') return 'Setup needed'
  if (tool.availability === 'unavailable') {
    if (isAiRewrite(tool)) return 'Unavailable'
    if (isNftAttach(tool)) return 'Unavailable'
    if (tool.requiresModule) return `Needs ${tool.requiresModule}`
    return 'Unavailable'
  }
  if (tool.availability === 'preview') return 'Preview'
  return 'Ready'
}

function unavailableMessage(tool: ComposerToolItem): string {
  return tool.description ?? availabilitySentence(tool)
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
}: ComposerToolsDrawerProps) {
  const router = useRouter()
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
    if (['requiresInstall', 'requiresEnable', 'requiresConfiguration'].includes(tool.availability)) {
      onClose()
      if (tool.moduleId) {
        router.push(`/marketplace/${encodeURIComponent(tool.moduleId)}` as Href)
        return
      }
      onBrowseMarketplace()
      return
    }
    if (tool.availability === 'unavailable' || isComingSoonTool(tool)) {
      Alert.alert(unavailableTitle(tool), unavailableMessage(tool))
      return
    }
    if (tool.availability === 'preview') {
      Alert.alert(`${tool.name} is not available`, availabilitySentence(tool))
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
    if (tool.toolId.toLowerCase().includes('vault')) {
      onClose()
      router.push('/module/digital.modula.vault-notes' as Href)
      return
    }
    setInvocationState('validating')
    setInvocationMessage(`Validating ${tool.name}…`)
    void (async () => {
      setInvocationState('running')
      const result = await services.toolsRepository.invokeFunction(tool.toolId, {})
      setInvocationState(result.state)
      if (result.jobId) {
        setInvocationMessage('Queued. You can keep writing.')
        return
      }
      if (result.state === 'failed') {
        setInvocationMessage(result.message ?? 'Failed')
        return
      }
      setInvocationMessage(result.message ?? 'Completed')
    })()
  }

  return (
    <ModulaSheet
      isPresented={visible}
      onDismiss={onClose}
      detent="large"
      header={
        <View style={{gap: spacing[1], paddingBottom: spacing[3]}}>
          <AppText variant="headline">Tools</AppText>
          <AppText variant="caption" colour="textSecondary">
            Photo, camera, and tools from modules you have installed.
          </AppText>
        </View>
      }
      footer={
        <View style={{paddingBottom: bottomPad}}>
          <AppPressable
            accessibilityLabel="Browse tools"
            onPress={() => {
              onClose()
              onBrowseMarketplace()
            }}>
            <AppText variant="label">Browse tools</AppText>
          </AppPressable>
        </View>
      }
      testID="composer-tools-sheet">
      <View style={{gap: spacing[4]}}>
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
              {invocationMessage ?? 'Working…'}
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
                  const unavailable = tool.availability === 'unavailable' || tool.availability.startsWith('requires')
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
                      <View style={[styles.toolHeader, {gap: spacing[2]}]}>
                        <AppIcon
                          name={iconFor(tool)}
                          colour={unavailable ? colours.textSecondary : colours.accent}
                          size={22}
                        />
                        <View style={styles.toolText}>
                          <AppText variant="caption" style={styles.toolName}>
                            {tool.name}
                          </AppText>
                          <AppText
                            variant="caption"
                            colour={unavailable ? 'textSecondary' : preview ? 'accent' : 'textTertiary'}>
                            {availabilitySentence(tool)}
                          </AppText>
                        </View>
                      </View>
                      {tool.description ? (
                        <AppText
                          variant="micro"
                          colour="textSecondary"
                          style={styles.toolDescription}>
                          {tool.description}
                        </AppText>
                      ) : null}
                    </AppPressable>
                  )
                })}
            </View>
          </View>
        ))}
      </View>
    </ModulaSheet>
  )
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tool: {
    alignItems: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth,
    flexBasis: '46%',
    flexGrow: 1,
    minHeight: 96,
    minWidth: '46%',
  },
  toolDescription: {
    width: '100%',
  },
  toolHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    width: '100%',
  },
  toolName: {
    flexShrink: 1,
  },
  toolText: {
    flex: 1,
    minWidth: 0,
  },
  status: {
    borderWidth: StyleSheet.hairlineWidth,
  },
})
