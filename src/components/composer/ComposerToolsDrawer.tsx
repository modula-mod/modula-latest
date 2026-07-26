import {useEffect, useMemo, useState} from 'react'
import {Alert, ScrollView, StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'
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

function isNftAttach(tool: ComposerToolItem): boolean {
  const key = `${tool.toolId} ${tool.name}`.toLowerCase()
  return key.includes('nft')
}

function isAiRewrite(tool: ComposerToolItem): boolean {
  const key = `${tool.toolId} ${tool.name}`.toLowerCase()
  return key.includes('airewrite') || key.includes('ai rewrite')
}

function unavailableTitle(tool: ComposerToolItem): string {
  if (isAiRewrite(tool)) return 'AI rewrite is unavailable'
  if (isNftAttach(tool)) return 'NFT attach is unavailable'
  return tool.requiresModule ? `Requires ${tool.requiresModule}` : 'Tool unavailable'
}

function availabilitySentence(tool: ComposerToolItem): string {
  if (tool.availability === 'requiresInstall') {
    return `Requires install. Open ${tool.requiresModule ?? 'the module'} to review permissions.`
  }
  if (tool.availability === 'requiresEnable') {
    return `Requires enable. Turn on ${tool.requiresModule ?? 'the module'} in module settings.`
  }
  if (tool.availability === 'requiresConfiguration') {
    return `Requires configuration. Finish ${tool.requiresModule ?? 'module'} settings first.`
  }
  if (tool.availability === 'unavailable') {
    if (isAiRewrite(tool)) {
      return 'Unavailable. An Agents manifest must grant composer rewrite scope before this can run.'
    }
    if (isNftAttach(tool)) {
      return 'Unavailable. DIMON is inactive, so Composer will not attach NFT claims.'
    }
    if (tool.requiresModule) {
      return `Unavailable. Enable the ${tool.requiresModule} module before using this tool.`
    }
    return 'Unavailable in this Preview build.'
  }
  if (tool.availability === 'preview') {
    return 'Preview. This runs locally or as a stub until a module manifest enables the full action.'
  }
  return 'Available from a registered manifest.'
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
  onPlaceholder,
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
    if (tool.availability === 'unavailable') {
      Alert.alert(unavailableTitle(tool), unavailableMessage(tool))
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
          <AppText variant="caption" colour="textSecondary">
            Tools register via manifests; this drawer shows whether each capability is available,
            preview-only, or blocked before anything runs.
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
                            variant="micro"
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
