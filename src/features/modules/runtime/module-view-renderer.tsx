import {useMemo, useState} from 'react'
import {ScrollView, StyleSheet, TextInput, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'
import type {
  GreenfieldModuleAction,
  GreenfieldModuleFieldDefinition,
  GreenfieldModuleLayoutNode,
} from '@modula/greenfield-module-ui-contracts'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import type {ModuleAIProductActionDefinition, ModuleHostExtensionContribution, ModuleRecord, ModuleRuntimeView} from '@/data/repositories/contracts'
import {ModuleAIActionMenu, SchemaSettingsRenderer} from '@/features/modules/components'
import {useModuleRecordMutations, useModuleRecordsQuery} from '@/features/modules/hooks'
import {ModuleActionBar} from '@/features/modules/runtime/module-action-bar'
import {ModuleEmptyState} from '@/features/modules/runtime/module-empty-state'
import {ModuleExtensionContributions} from '@/features/modules/runtime/module-extension-contributions'
import {ModuleFieldRenderer} from '@/features/modules/runtime/module-field-renderer'
import {primaryActionFor} from '@/features/modules/runtime/module-action-runner'
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
  const recordsQuery = useModuleRecordsQuery(moduleId, collection, {q: query || undefined, sort: 'updatedAt', direction: 'desc'})
  const mutations = useModuleRecordMutations(moduleId, collection)
  const createAction = primaryActionFor(view.allowedActions ?? view.toolbar, 'record.create')
  const fields = useMemo(
    () => createAction?.inputSchema.fields ?? [],
    [createAction?.inputSchema.fields],
  )
  const [draft, setDraft] = useState<Record<string, unknown>>({})
  const [editing, setEditing] = useState<ModuleRecord | null>(null)
  const records = recordsQuery.data?.items ?? []
  const allActions = view.allowedActions ?? view.toolbar ?? []

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
    if (action.kind === 'route.open' && action.target?.routePath) {
      router.push(action.target.routePath as Href)
      return
    }
    await moduleRepository.runAction(moduleId, action.actionId, input)
  }

  const saveDraft = async () => {
    if (!collection) return
    if (editing) {
      mutations.update.mutate({recordId: editing.record_id, data: draft, expectedRevision: editing.revision}, {onSuccess: () => {
        setDraft({})
        setEditing(null)
      }})
      return
    }
    if (createAction) {
      await runAction(createAction, draft)
        .then(async () => {
          setDraft({})
          await recordsQuery.refetch()
        })
        .catch(() => mutations.create.mutate(draft, {onSuccess: () => setDraft({})}))
    } else {
      mutations.create.mutate(draft, {onSuccess: () => setDraft({})})
    }
  }

  if (view.kind === 'settings') {
    return (
      <View style={{gap: spacing[4]}}>
        <AppText variant="display">{view.title}</AppText>
        <SchemaSettingsRenderer moduleId={moduleId} />
      </View>
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

  return (
    <View style={{gap: spacing[4]}}>
      <View style={{gap: spacing[2]}}>
        <AppText variant="display">{view.title}</AppText>
        <ModuleActionBar
          actions={allActions}
          onAction={action => { void runAction(action) }}
        />
        {view.kind === 'collection' ? (
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

      {view.layout.length ? (
        <View style={{gap: spacing[3]}}>
          {view.layout.map(node => (
            <LayoutNode key={node.id} node={node} actions={allActions} onAction={runAction} />
          ))}
        </View>
      ) : null}

      {allActions.filter(action => action.kind !== 'record.create').length ? (
        <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2]}}>
          {allActions.filter(action => action.kind !== 'record.create').map(action => (
            <ModulaButton
              key={action.actionId}
              label={action.label}
              role={action.destructive ? 'destructive' : 'secondary'}
              onPress={() => { void runAction(action) }}
            />
          ))}
        </View>
      ) : null}

      {fields.length ? (
        <View style={[styles.panel, {backgroundColor: colours.surfaceRaised, borderColor: colours.border, borderRadius: radius.large, gap: spacing[3], padding: spacing[4]}]}>
          <AppText variant="headline">{editing ? 'Edit record' : createAction?.label ?? 'Create record'}</AppText>
          {fields.map(field => (
            <ModuleFieldRenderer
              key={field.fieldId}
              field={field}
              value={draft[field.name]}
              onChange={value => setDraft(current => ({...current, [field.name]: value}))}
            />
          ))}
          <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2]}}>
            <ModulaButton
              label={editing ? 'Save' : 'Create'}
              accessibilityLabel={editing ? 'Edit note' : 'Create note'}
              loading={mutations.create.isPending || mutations.update.isPending}
              onPress={() => { void saveDraft() }}
            />
            {editing ? <ModulaButton label="Cancel" role="secondary" onPress={() => { setEditing(null); setDraft({}) }} /> : null}
          </View>
        </View>
      ) : null}

      {recordsQuery.isPending ? (
        <AppText variant="caption" colour="textSecondary">Loading records.</AppText>
      ) : records.length ? (
        <ScrollView contentContainerStyle={{gap: spacing[3]}}>
          {records.map(record => (
            <RecordRow
              key={record.record_id}
              record={record}
              fields={fields}
              moduleId={moduleId}
              collection={collection}
              aiActions={aiActions}
              extensionContributions={extensionContributions}
              onEdit={() => {
                setEditing(record)
                setDraft(record.data)
              }}
              onDelete={() => mutations.remove.mutate({recordId: record.record_id, expectedRevision: record.revision})}
            />
          ))}
        </ScrollView>
      ) : (
        <ModuleEmptyState
          title={view.emptyState?.title ?? view.title}
          body={view.emptyState?.body ?? 'Create the first record when you are ready.'}
          primaryAction={
            createAction
              ? {label: createAction.label, onPress: () => { void runAction(createAction, draft) }}
              : undefined
          }
        />
      )}
    </View>
  )
}

function LayoutNode({
  node,
  actions,
  onAction,
}: {
  node: GreenfieldModuleLayoutNode
  actions: GreenfieldModuleAction[]
  onAction: (action: GreenfieldModuleAction) => Promise<void>
}) {
  const {colours, radius, spacing} = useThemeTokens()
  if (node.component === 'section') {
    return (
      <View style={[styles.panel, {backgroundColor: colours.surface, borderColor: colours.border, borderRadius: radius.large, gap: spacing[2], padding: spacing[4]}]}>
        {node.title ? <AppText variant="headline">{node.title}</AppText> : null}
        {node.text ? <AppText variant="caption" colour="textSecondary">{node.text}</AppText> : null}
        {node.children?.map(child => <LayoutNode key={child.id} node={child} actions={actions} onAction={onAction} />)}
      </View>
    )
  }
  if (node.component === 'text') return <AppText variant="body" colour="textSecondary">{node.text ?? node.label ?? ''}</AppText>
  if (node.component === 'label') return <AppText variant="label">{node.label ?? node.text ?? ''}</AppText>
  if (node.component === 'metadata') return <AppText variant="micro" colour="textTertiary">{node.label ?? node.text ?? node.field ?? ''}</AppText>
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
  fields,
  moduleId,
  collection,
  aiActions,
  extensionContributions,
  onEdit,
  onDelete,
}: {
  record: ModuleRecord
  fields: GreenfieldModuleFieldDefinition[]
  moduleId: string
  collection: string
  aiActions: ModuleAIProductActionDefinition[]
  extensionContributions: ModuleHostExtensionContribution[]
  onEdit: () => void
  onDelete: () => void
}) {
  const {spacing} = useThemeTokens()
  const titleField = fields.find(field => field.name === 'title') ?? fields[0]
  const title = titleField ? String(record.data[titleField.name] ?? 'Untitled') : 'Record'
  const body = fields.find(field => field.name === 'body')
  const tags = record.data.tags
  const tagCount = Array.isArray(tags) ? tags.length : 0
  const updated = record.updated_at ?? record.updatedAt ?? ''
  return (
    <View style={{gap: spacing[2], paddingVertical: spacing[3]}}>
      <AppText variant="headline">{title}</AppText>
      {body && record.data[body.name] ? (
        <AppText variant="caption" colour="textSecondary" numberOfLines={2}>{String(record.data[body.name])}</AppText>
      ) : null}
      <AppText variant="micro" colour="textTertiary">
        {[updated ? relativeDay(updated) : null, tagCount ? `${tagCount} tags` : null].filter(Boolean).join('  ·  ')}
      </AppText>
      <View style={{alignItems: 'center', flexDirection: 'row', gap: spacing[2]}}>
        <AppPressable accessibilityLabel="Edit record" onPress={onEdit}>
          <AppText variant="label" colour="accent">Edit</AppText>
        </AppPressable>
        <AppPressable accessibilityLabel="Delete record" onPress={onDelete}>
          <AppText variant="label" colour="destructive">Delete</AppText>
        </AppPressable>
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
