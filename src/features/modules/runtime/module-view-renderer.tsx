import {useMemo, useState} from 'react'
import {FlatList, ScrollView, Share, StyleSheet, TextInput, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'
import type {
  GreenfieldModuleAction,
  GreenfieldModuleLayoutNode,
} from '@modula/greenfield-module-ui-contracts'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import type {ModuleAIProductActionDefinition, ModuleHostExtensionContribution, ModuleRecord, ModuleRuntimeView} from '@/data/repositories/contracts'
import {ModuleAIActionMenu, SchemaSettingsRenderer} from '@/features/modules/components'
import {useModuleRecordMutations, useModuleRecordQuery, useModuleRecordsQuery, useModuleSettingsMutation, useModuleSettingsQuery} from '@/features/modules/hooks'
import {ModuleActionBar} from '@/features/modules/runtime/module-action-bar'
import {ModuleEmptyState} from '@/features/modules/runtime/module-empty-state'
import {ModuleExtensionContributions} from '@/features/modules/runtime/module-extension-contributions'
import {ModuleFieldRenderer} from '@/features/modules/runtime/module-field-renderer'
import {primaryActionFor} from '@/features/modules/runtime/module-action-runner'
import {resolveRuntimeActionRoute, shapeMpsActionInput} from '@/features/modules/runtime/mps-frontend-adapter'
import {ModulaButton} from '@/platform/ui/buttons/modula-button'
import {confirmModulaAction} from '@/platform/ui/menus/confirmModulaAction'
import {useAppServices} from '@/runtime/useAppServices'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function ModuleViewRenderer({moduleId, view, aiActions = [], extensionContributions = []}: {moduleId: string; view: ModuleRuntimeView; aiActions?: ModuleAIProductActionDefinition[]; extensionContributions?: ModuleHostExtensionContribution[]}) {
  const router = useRouter()
  const {moduleRepository} = useAppServices()
  const {colours, radius, spacing} = useThemeTokens()
  const [query, setQuery] = useState('')
  const collection = view.collection ?? view.query?.collection ?? ''
  const recordsQuery = useModuleRecordsQuery(moduleId, view.kind === 'collection' ? collection : '', {
    q: query || undefined,
    sort: 'updatedAt',
    direction: 'desc',
    filters: view.query?.filters,
    recordState: view.query?.recordState,
  })
  const recordQuery = useModuleRecordQuery(moduleId, view.recordBinding?.collection ?? '', view.recordBinding?.recordId ?? '')
  const settingsQuery = useModuleSettingsQuery(moduleId, view.kind === 'settings')
  const settingsMutation = useModuleSettingsMutation(moduleId)
  const mutations = useModuleRecordMutations(moduleId, collection)
  const createAction = primaryActionFor(view.allowedActions ?? view.toolbar, 'record.create')
  const updateAction = primaryActionFor(view.allowedActions ?? view.toolbar, 'record.update')
  const settingsAction = primaryActionFor(view.allowedActions ?? view.toolbar, 'settings.update')
  const formAction = view.kind === 'settings' ? settingsAction : view.recordBinding ? updateAction : createAction
  const fields = useMemo(
    () => formAction?.inputSchema.fields ?? [],
    [formAction?.inputSchema.fields],
  )
  const records = recordsQuery.data?.items ?? []
  const allActions = view.allowedActions ?? view.toolbar ?? []
  const sourceDraft = view.kind === 'form'
    ? recordQuery.data
      ? {source: `record:${recordQuery.data.record_id}:${recordQuery.data.revision}`, values: recordQuery.data.data}
      : {source: view.recordBinding ? `record:loading:${view.recordBinding.recordId}` : 'new', values: {}}
    : view.kind === 'settings' && settingsQuery.data
      ? {source: `settings:${settingsQuery.data.installationId}:${settingsQuery.data.version}`, values: settingsQuery.data.values}
      : {source: 'none', values: {}}
  const [editedDraft, setEditedDraft] = useState<{source: string; values: Record<string, unknown>}>({source: '', values: {}})
  const draft = editedDraft.source === sourceDraft.source ? editedDraft.values : sourceDraft.values
  const updateDraftField = (name: string, value: unknown) => setEditedDraft({source: sourceDraft.source, values: {...draft, [name]: value}})

  const runAction = async (action: GreenfieldModuleAction, input: Record<string, unknown> = {}) => {
    if (action.confirmationPolicy === 'confirm' || action.confirmationPolicy === 'confirmDestructive' || action.confirmationPolicy === 'recentAuth') {
      const confirmed = await confirmModulaAction({
        title: action.label,
        message: action.destructive ? 'This module action is destructive and will be audited.' : 'Run this module action?',
        confirmLabel: action.label,
        cancelLabel: 'Cancel',
        destructive: action.destructive,
      })
      if (!confirmed) return
    }
    const shaped = shapeMpsActionInput(action, input)
    const recordIdField = action.target?.recordIdField ?? 'recordId'
    const boundRecord = recordQuery.data
    if (boundRecord && shaped[recordIdField] === undefined) shaped[recordIdField] = boundRecord.record_id
    if (boundRecord && shaped.expectedRevision === undefined) shaped.expectedRevision = boundRecord.revision
    if (action.kind === 'route.open') {
      const route = resolveRuntimeActionRoute(action, shaped)
      if (!route) throw new Error('Module route action is missing required route parameters')
      router.push(route as Href)
      return
    }
    if (action.kind === 'share') {
      await Share.share({message: String(shaped.text ?? shaped.title ?? boundRecord?.data.title ?? view.title)})
      return
    }
    if (action.kind === 'dismiss') {
      router.back()
      return
    }
    if (action.kind === 'record.create') {
      await mutations.create.mutateAsync(shaped)
      setEditedDraft({source: sourceDraft.source, values: {}})
      return
    }
    const recordId = typeof shaped[recordIdField] === 'string' ? shaped[recordIdField] : ''
    const expectedRevision = typeof shaped.expectedRevision === 'number' ? shaped.expectedRevision : undefined
    if (action.kind === 'record.update' && recordId) {
      await mutations.update.mutateAsync({recordId, data: recordDataForAction(shaped, recordIdField), expectedRevision})
      return
    }
    if (action.kind === 'record.delete' && recordId) return void await mutations.remove.mutateAsync({recordId, expectedRevision})
    if (action.kind === 'record.restore' && recordId) return void await mutations.restore.mutateAsync({recordId, expectedRevision})
    if (action.kind === 'record.purge' && recordId) return void await mutations.purge.mutateAsync({recordId, expectedRevision})
    if (action.kind === 'settings.update') return void await settingsMutation.mutateAsync(shaped)
    await moduleRepository.runAction(moduleId, action.actionId, shaped)
  }

  if (view.kind === 'settings') {
    if (!fields.length) {
      return (
        <View style={{gap: spacing[4]}}>
          <AppText variant="display">{view.title}</AppText>
          <SchemaSettingsRenderer moduleId={moduleId} />
        </View>
      )
    }
    return (
      <ScrollView contentContainerStyle={{gap: spacing[4]}} keyboardShouldPersistTaps="handled">
        <AppText variant="display">{view.title}</AppText>
        {fields.map(field => (
          <ModuleFieldRenderer key={field.fieldId} field={field} value={draft[field.name]} onChange={value => updateDraftField(field.name, value)} />
        ))}
        {view.layout.map(node => <LayoutNode key={node.id} node={node} actions={allActions} data={draft} onAction={action => runAction(action, draft)} />)}
      </ScrollView>
    )
  }

  if (view.kind === 'emptyState') {
    return (
      <ModuleEmptyState
        title={view.emptyState?.title ?? view.title}
        body={view.emptyState?.body}
        primaryAction={
          createAction
            ? {label: createAction.label, onPress: () => { void runAction(createAction, draft) }}
            : undefined
        }
      />
    )
  }

  const header = (
    <View style={{gap: spacing[4]}}>
      <View style={{gap: spacing[2]}}>
        <AppText variant="display">{view.title}</AppText>
        <ModuleActionBar
          actions={view.toolbar ?? []}
          onAction={action => { void runAction(action) }}
        />
        {view.kind === 'collection' && view.searchEnabled ? (
          <View
            style={[
              styles.search,
              {
                backgroundColor: colours.surface,
                borderColor: colours.border,
                borderRadius: radius.round,
                paddingHorizontal: spacing[3],
              },
            ]}>
            <TextInput
              accessibilityLabel="Search module records"
              value={query}
              onChangeText={setQuery}
              placeholder="Search"
              placeholderTextColor={colours.textTertiary}
              style={{color: colours.text, flex: 1, minHeight: 44}}
            />
          </View>
        ) : null}
      </View>

      {view.kind === 'form' && recordQuery.isPending && view.recordBinding ? <AppText variant="caption" colour="textSecondary">Loading record.</AppText> : null}
      {view.kind === 'form' && fields.length ? (
        <View style={[styles.panel, {backgroundColor: colours.surfaceRaised, borderColor: colours.border, borderRadius: radius.large, gap: spacing[3], padding: spacing[4]}]}>
          <AppText variant="headline">{view.recordBinding ? updateAction?.label ?? 'Edit record' : createAction?.label ?? 'Create record'}</AppText>
          {fields.map(field => (
            <ModuleFieldRenderer
              key={field.fieldId}
              field={field}
              value={draft[field.name]}
              onChange={value => updateDraftField(field.name, value)}
            />
          ))}
        </View>
      ) : null}
      {view.layout.length ? (
        <View style={{gap: spacing[3]}}>
          {view.layout.map(node => (
            <LayoutNode key={node.id} node={node} actions={allActions} data={recordQuery.data?.data ?? draft} onAction={action => runAction(action, draft)} />
          ))}
        </View>
      ) : null}
    </View>
  )

  if (view.kind === 'collection') {
    return (
      <FlatList
        contentContainerStyle={{gap: spacing[3], paddingBottom: spacing[6]}}
        data={records}
        keyExtractor={record => record.record_id}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={header}
        ListEmptyComponent={recordsQuery.isPending
          ? <AppText variant="caption" colour="textSecondary">Loading records.</AppText>
          : <ModuleEmptyState title={view.emptyState?.title ?? view.title} body={view.emptyState?.body ?? 'Create the first record when you are ready.'} primaryAction={createAction ? {label: createAction.label, onPress: () => { void runAction(createAction, draft) }} : undefined} />}
        renderItem={({item}) => (
          <RecordRow
            record={item}
            actions={allActions}
            recordListActionIds={view.recordListActionIds ?? []}
            moduleId={moduleId}
            collection={collection}
            aiActions={aiActions}
            extensionContributions={extensionContributions}
            onAction={runAction}
          />
        )}
      />
    )
  }

  if (view.recordBinding && recordQuery.isError) return <ModuleEmptyState title="Record unavailable" body="This record could not be loaded for the current product and account." />
  return (
    <ScrollView contentContainerStyle={{gap: spacing[4], paddingBottom: spacing[6]}} keyboardShouldPersistTaps="handled">
      {header}
    </ScrollView>
  )
}

function recordDataForAction(input: Record<string, unknown>, recordIdField: string): Record<string, unknown> {
  const omitted = new Set([recordIdField, 'recordId', 'expectedRevision', 'idempotencyKey', 'confirm'])
  return Object.fromEntries(Object.entries(input).filter(([key]) => !omitted.has(key)))
}

function LayoutNode({
  node,
  actions,
  data,
  onAction,
}: {
  node: GreenfieldModuleLayoutNode
  actions: GreenfieldModuleAction[]
  data: Record<string, unknown>
  onAction: (action: GreenfieldModuleAction) => Promise<void>
}) {
  const {colours, radius, spacing} = useThemeTokens()
  if (node.component === 'section') {
    return (
      <View style={[styles.panel, {backgroundColor: colours.surface, borderColor: colours.border, borderRadius: radius.large, gap: spacing[2], padding: spacing[4]}]}>
        {node.title ? <AppText variant="headline">{node.title}</AppText> : null}
        {node.text ? <AppText variant="caption" colour="textSecondary">{node.text}</AppText> : null}
        {node.children?.map(child => <LayoutNode key={child.id} node={child} actions={actions} data={data} onAction={onAction} />)}
      </View>
    )
  }
  if (node.component === 'text') return <AppText variant="body" colour="textSecondary">{displayValue(node.field ? data[node.field] : undefined, node.text ?? node.label ?? '')}</AppText>
  if (node.component === 'label') return <AppText variant="label">{node.label ?? node.text ?? ''}</AppText>
  if (node.component === 'metadata') return <AppText variant="micro" colour="textTertiary">{displayValue(node.field ? data[node.field] : undefined, node.label ?? node.text ?? node.field ?? '')}</AppText>
  if (node.component === 'badge') {
    return (
      <View style={[styles.badge, {backgroundColor: colours.accentSubtle, borderColor: colours.accentBorder, borderRadius: radius.round, paddingHorizontal: spacing[2], paddingVertical: spacing[1]}]}>
        <AppText variant="micro" colour="accent">{node.label ?? node.text ?? node.variant ?? 'Badge'}</AppText>
      </View>
    )
  }
  if (node.component === 'divider') return <View style={{backgroundColor: colours.separator, height: StyleSheet.hairlineWidth}} />
  if (node.component === 'button' && node.actionId) {
    const action = actions.find(item => item.actionId === node.actionId)
    if (!action) return null
    return <ModulaButton label={node.label ?? action.label} role={action.destructive ? 'destructive' : 'secondary'} onPress={() => { void onAction(action) }} />
  }
  if (node.component === 'emptyState') return <ModuleEmptyState title={node.title ?? 'Nothing here'} body={node.text} />
  if (node.component === 'errorState') return <AppText variant="caption" colour="destructive">{node.text ?? node.title ?? 'Module content unavailable'}</AppText>
  if (node.component === 'loadingState') return <AppText variant="caption" colour="textSecondary">{node.text ?? 'Loading'}</AppText>
  return null
}

function RecordRow({
  record,
  actions,
  recordListActionIds,
  moduleId,
  collection,
  aiActions,
  extensionContributions,
  onAction,
}: {
  record: ModuleRecord
  actions: GreenfieldModuleAction[]
  recordListActionIds: string[]
  moduleId: string
  collection: string
  aiActions: ModuleAIProductActionDefinition[]
  extensionContributions: ModuleHostExtensionContribution[]
  onAction: (action: GreenfieldModuleAction, input: Record<string, unknown>) => Promise<void>
}) {
  const {spacing} = useThemeTokens()
  const title = String(record.data.title ?? record.data.name ?? record.data.label ?? 'Untitled')
  const body = record.data.plainTextProjection ?? record.data.body ?? record.data.description
  const tags = record.data.tagIds ?? record.data.tags ?? record.data.labels
  const tagCount = Array.isArray(tags) ? tags.length : 0
  const updated = record.updated_at ?? record.updatedAt ?? ''
  const rowActions = recordListActionIds.flatMap(id => {
    const action = actions.find(candidate => candidate.actionId === id)
    return action ? [action] : []
  })
  const openAction = rowActions.find(action => action.kind === 'route.open')
  const secondaryActions = rowActions.filter(action => action !== openAction)
  const recordInput = (action: GreenfieldModuleAction) => ({
    [action.target?.recordIdField ?? 'recordId']: record.record_id,
    expectedRevision: record.revision,
  })
  return (
    <View style={{gap: spacing[2], paddingVertical: spacing[3]}}>
      <AppPressable accessibilityLabel={openAction ? `Open ${title}` : title} disabled={!openAction} onPress={() => { if (openAction) void onAction(openAction, recordInput(openAction)) }}>
        <View style={{gap: spacing[2]}}>
          <AppText variant="headline">{title}</AppText>
          {body ? <AppText variant="caption" colour="textSecondary" numberOfLines={2}>{displayValue(body, '')}</AppText> : null}
        </View>
      </AppPressable>
      <AppText variant="micro" colour="textTertiary">
        {[updated ? relativeDay(updated) : null, tagCount ? `${tagCount} tags` : null].filter(Boolean).join('  ·  ')}
      </AppText>
      {secondaryActions.length ? (
        <View style={{alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2]}}>
          {secondaryActions.map(action => (
            <ModulaButton key={action.actionId} label={action.label} role={action.destructive ? 'destructive' : 'secondary'} onPress={() => { void onAction(action, recordInput(action)) }} />
          ))}
        </View>
      ) : null}
      <View style={{alignItems: 'center', flexDirection: 'row', gap: spacing[2]}}>
        <ModuleAIActionMenu
          moduleId={moduleId}
          collection={collection}
          record={record}
          actions={aiActions}
        />
      </View>
      <ModuleExtensionContributions moduleId={moduleId} contributions={extensionContributions} record={record} />
    </View>
  )
}

function displayValue(value: unknown, fallback: string): string {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (value && typeof value === 'object') {
    const text = JSON.stringify(value)
    return text.length <= 2_000 ? text : `${text.slice(0, 1_997)}...`
  }
  return fallback
}

function relativeDay(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const then = new Date(date)
  then.setHours(0, 0, 0, 0)
  const delta = Math.round((start.getTime() - then.getTime()) / 86_400_000)
  if (delta === 0) return 'Today'
  if (delta === 1) return 'Yesterday'
  if (delta < 7) return `${delta} days ago`
  return date.toLocaleDateString()
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth,
  },
  panel: {borderWidth: StyleSheet.hairlineWidth},
  search: {
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 46,
  },
})
