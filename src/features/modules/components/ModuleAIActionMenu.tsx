import {useMemo, useState} from 'react'
import {ScrollView, StyleSheet, View} from 'react-native'
import * as Clipboard from 'expo-clipboard'

import {AppText} from '@/components/primitives/AppText'
import type {
  ModuleAIActionExecutionResponse,
  ModuleAIProductActionDefinition,
  ModuleRecord,
} from '@/data/repositories/contracts'
import {useModuleAIMutations} from '@/features/modules/hooks'
import {ModulaButton} from '@/platform/ui/buttons/modula-button'
import {ChromeOverflowMenu} from '@/platform/ui/menus/chrome-overflow-menu'
import {ModulaSheet} from '@/platform/ui/sheets/modula-sheet'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type ExecutionStatus =
  | 'available'
  | 'queued'
  | 'running'
  | 'permission required'
  | 'provider not configured'
  | 'provider unavailable'
  | 'model unavailable'
  | 'quota exceeded'
  | 'preparing context'
  | 'generating'
  | 'streaming'
  | 'validating'
  | 'completed'
  | 'cancelled'
  | 'failed'
  | 'result expired'
  | 'revision conflict'
  | 'applying'
  | 'applied'

type ModuleAIActionMenuProps = {
  moduleId: string
  collection: string
  record: ModuleRecord
  actions: ModuleAIProductActionDefinition[]
  selectedText?: string
}

export function ModuleAIActionMenu({
  moduleId,
  collection,
  record,
  actions,
  selectedText,
}: ModuleAIActionMenuProps) {
  const runnableActions = useMemo(() => actions.filter(action => action.id && action.name), [actions])
  const [selectedAction, setSelectedAction] = useState<ModuleAIProductActionDefinition | null>(null)
  const [execution, setExecution] = useState<ModuleAIActionExecutionResponse | null>(null)
  const [status, setStatus] = useState<ExecutionStatus>('available')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const mutations = useModuleAIMutations(moduleId, collection)

  if (!runnableActions.length) return null

  const start = async (action: ModuleAIProductActionDefinition) => {
    setSelectedAction(action)
    setExecution(null)
    setErrorMessage(null)
    if (action.context.sources.includes('selected-content') && !selectedText) {
      setStatus('permission required')
      setErrorMessage('Select note text before running this AI action.')
      return
    }
    try {
      setStatus('preparing context')
      const result = await mutations.execute.mutateAsync({
        actionId: action.id,
        recordId: record.record_id,
        expectedRevision: record.revision,
        selection: selectedText ? {text: selectedText} : undefined,
        variables: defaultVariables(action),
        streaming: action.execution.streaming,
      })
      setStatus(result.streamPath ? 'streaming' : 'validating')
      setExecution(result)
      setStatus(result.status === 'completed' ? 'completed' : result.status === 'expired' ? 'result expired' : result.status)
    } catch (error) {
      const normalized = normalizeExecutionError(error)
      setStatus(normalized.status)
      setErrorMessage(normalized.message)
    }
  }

  return (
    <>
      <ChromeOverflowMenu
        title="AI tools"
        accessibilityLabel="AI tools"
        actions={runnableActions.map(action => ({
          id: action.id,
          label: action.name,
          disabled: action.context.sources.includes('selected-content') && !selectedText,
          disabledReason: 'Select note text first.',
        }))}
        onAction={id => {
          const action = runnableActions.find(item => item.id === id)
          if (action) void start(action)
        }}
      />
      <ModuleAIExecutionSheet
        isPresented={Boolean(selectedAction)}
        moduleId={moduleId}
        collection={collection}
        record={record}
        action={selectedAction}
        execution={execution}
        status={status}
        errorMessage={errorMessage}
        applying={mutations.apply.isPending}
        onCancel={() => setStatus('cancelled')}
        onRetry={() => { if (selectedAction) void start(selectedAction) }}
        onReject={() => {
          setSelectedAction(null)
          setExecution(null)
          setStatus('available')
          setErrorMessage(null)
        }}
        onApply={async () => {
          if (!selectedAction || !execution?.result) return
          try {
            setStatus('applying')
            await mutations.apply.mutateAsync({
              executionId: execution.executionId,
              recordId: record.record_id,
              expectedRevision: record.revision,
              selectedResult: execution.result,
            })
            setStatus('applied')
          } catch (error) {
            const normalized = normalizeExecutionError(error)
            setStatus(normalized.status)
            setErrorMessage(normalized.message)
          }
        }}
        onDismiss={() => {
          setSelectedAction(null)
          setExecution(null)
          setStatus('available')
          setErrorMessage(null)
        }}
      />
    </>
  )
}

export function ModuleAIExecutionSheet({
  isPresented,
  action,
  execution,
  status,
  errorMessage,
  applying,
  record,
  onCancel,
  onRetry,
  onReject,
  onApply,
  onDismiss,
}: {
  isPresented: boolean
  moduleId: string
  collection: string
  record: ModuleRecord
  action: ModuleAIProductActionDefinition | null
  execution: ModuleAIActionExecutionResponse | null
  status: ExecutionStatus
  errorMessage: string | null
  applying: boolean
  onCancel: () => void
  onRetry: () => void
  onReject: () => void
  onApply: () => void
  onDismiss: () => void
}) {
  const {colours, spacing} = useThemeTokens()
  const resultText = execution?.result ? JSON.stringify(execution.result, null, 2) : ''

  return (
    <ModulaSheet isPresented={isPresented} onDismiss={onDismiss} snapPoints={['half', 'full']} testID="module-ai-execution-sheet">
      <View style={{gap: spacing[4]}}>
        <View style={{gap: spacing[1]}}>
          <AppText variant="title2">{action?.name ?? 'AI action'}</AppText>
          <AppText variant="caption" colour="textSecondary">
            Generated content may be inaccurate. Review it before applying changes.
          </AppText>
        </View>
        <ModuleAIStreamingResult status={status} errorMessage={errorMessage} />
        {execution?.result ? (
          <ScrollView style={[styles.resultBox, {borderColor: colours.border, backgroundColor: colours.surfaceRaised}]}>
            <ModuleAIResultPreview result={execution.result} />
            <ModuleAIResultDiff action={action} record={record} result={execution.result} />
          </ScrollView>
        ) : status === 'permission required' || status === 'provider unavailable' || status === 'quota exceeded' || status === 'failed' ? (
          <ModuleAIUnavailableState status={status} message={errorMessage} />
        ) : null}
        {execution ? <ModuleAIUsageNotice execution={execution} /> : null}
        <ModuleAIApplyControls
          action={action}
          execution={execution}
          status={status}
          applying={applying}
          onCancel={onCancel}
          onRetry={onRetry}
          onCopy={() => { if (resultText) void Clipboard.setStringAsync(resultText) }}
          onReject={onReject}
          onApply={onApply}
        />
      </View>
    </ModulaSheet>
  )
}

export function ModuleAIStreamingResult({status, errorMessage}: {status: ExecutionStatus; errorMessage: string | null}) {
  const {colours, radius, spacing} = useThemeTokens()
  return (
    <View style={[styles.status, {backgroundColor: colours.surface, borderColor: colours.border, borderRadius: radius.md, padding: spacing[3]}]}>
      <AppText variant="label">{statusLabel(status)}</AppText>
      {errorMessage ? <AppText variant="caption" colour="textSecondary">{errorMessage}</AppText> : null}
    </View>
  )
}

export function ModuleAIResultPreview({result}: {result: Record<string, unknown>}) {
  return (
    <View style={styles.preview}>
      <AppText variant="label">Preview</AppText>
      <AppText variant="caption" colour="textSecondary" selectable>
        {JSON.stringify(result, null, 2)}
      </AppText>
    </View>
  )
}

export function ModuleAIResultDiff({
  action,
  record,
  result,
}: {
  action: ModuleAIProductActionDefinition | null
  record: ModuleRecord
  result: Record<string, unknown>
}) {
  if (!action || action.application.mode !== 'replace-selection') return null
  return (
    <View style={styles.diff}>
      <AppText variant="label">Proposed replacement</AppText>
      <AppText variant="caption" colour="textSecondary" numberOfLines={4}>
        {String(record.data.plainTextProjection ?? record.data.body ?? '')}
      </AppText>
      <AppText variant="caption">{String(result.replacement ?? '')}</AppText>
    </View>
  )
}

export function ModuleAIApplyControls({
  action,
  execution,
  status,
  applying,
  onCancel,
  onRetry,
  onCopy,
  onReject,
  onApply,
}: {
  action: ModuleAIProductActionDefinition | null
  execution: ModuleAIActionExecutionResponse | null
  status: ExecutionStatus
  applying: boolean
  onCancel: () => void
  onRetry: () => void
  onCopy: () => void
  onReject: () => void
  onApply: () => void
}) {
  const {spacing} = useThemeTokens()
  const canApply = Boolean(
    action &&
    execution?.result &&
    action.application.createsRecordRevision &&
    action.application.mode !== 'preview-only' &&
    status !== 'applied',
  )
  return (
    <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2]}}>
      {status === 'preparing context' || status === 'generating' || status === 'streaming' ? (
        <ModulaButton label="Cancel" role="secondary" onPress={onCancel} />
      ) : null}
      <ModulaButton label="Retry" role="secondary" disabled={status === 'applying'} onPress={onRetry} />
      <ModulaButton label="Copy" role="secondary" disabled={!execution?.result} onPress={onCopy} />
      <ModulaButton label="Reject" role="secondary" onPress={onReject} />
      {canApply ? <ModulaButton label={status === 'applied' ? 'Applied' : 'Apply'} loading={applying || status === 'applying'} onPress={onApply} /> : null}
    </View>
  )
}

export function ModuleAIUnavailableState({status, message}: {status: ExecutionStatus; message: string | null}) {
  const {colours, radius, spacing} = useThemeTokens()
  return (
    <View style={[styles.status, {backgroundColor: colours.surface, borderColor: colours.border, borderRadius: radius.md, padding: spacing[3]}]}>
      <AppText variant="label">{statusLabel(status)}</AppText>
      <AppText variant="caption" colour="textSecondary">{message ?? 'AI is unavailable for this module action.'}</AppText>
    </View>
  )
}

export function ModuleAIUsageNotice({execution}: {execution: ModuleAIActionExecutionResponse}) {
  const usage = execution.usage ?? {}
  const model = String(usage.modelId ?? 'resolved model')
  const inputTokens = usage.inputTokens === undefined ? '-' : String(usage.inputTokens)
  const outputTokens = usage.outputTokens === undefined ? '-' : String(usage.outputTokens)
  return (
    <AppText variant="micro" colour="textTertiary">
      {model} | input {inputTokens} | output {outputTokens} | expires {execution.expiresAt}
    </AppText>
  )
}

function defaultVariables(action: ModuleAIProductActionDefinition): Record<string, unknown> {
  if (action.id.includes('rewrite-selection')) return {transformation: 'clearer'}
  if (action.id.includes('summarise')) return {summaryLength: 'standard'}
  return {}
}

function normalizeExecutionError(error: unknown): {status: ExecutionStatus; message: string} {
  const text = error instanceof Error ? error.message : 'AI action failed'
  if (text.includes('NOTE_REVISION_CONFLICT')) return {status: 'revision conflict', message: text}
  if (text.includes('AI_QUOTA_EXCEEDED')) return {status: 'quota exceeded', message: text}
  if (text.includes('AI_ACTION_PERMISSION_REQUIRED') || text.includes('AI_CONTEXT_PERMISSION_REQUIRED')) return {status: 'permission required', message: text}
  if (text.includes('AI_MODEL_UNAVAILABLE') || text.includes('AI_CAPABILITY_UNAVAILABLE')) return {status: 'model unavailable', message: text}
  if (text.includes('AI_PROVIDER_UNAVAILABLE') || text.includes('CAPABILITY_DISABLED')) return {status: 'provider unavailable', message: text}
  if (text.includes('AI_RESULT_EXPIRED')) return {status: 'result expired', message: text}
  return {status: 'failed', message: text}
}

function statusLabel(status: ExecutionStatus): string {
  if (status === 'available') return 'Available'
  return status.replace(/^./, char => char.toUpperCase())
}

const styles = StyleSheet.create({
  diff: {
    gap: 8,
    marginTop: 12,
  },
  preview: {
    gap: 8,
  },
  resultBox: {
    borderWidth: StyleSheet.hairlineWidth,
    maxHeight: 320,
    padding: 12,
  },
  status: {
    borderWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
})
