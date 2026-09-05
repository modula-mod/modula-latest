import {Switch, View} from 'react-native'
import type {GreenfieldModuleFieldDefinition} from '@modula/greenfield-module-ui-contracts'

import {AppText} from '@/components/primitives/AppText'
import {useModuleRecordsQuery} from '@/features/modules/hooks'
import {richTextDocumentFromText, richTextEditingText} from '@/features/modules/runtime/mps-frontend-adapter'
import {ModulaFieldShell} from '@/platform/ui/controls/modula-field-shell'
import {ModulaSelectField} from '@/platform/ui/controls/modula-select-field'
import {ModulaTagInput} from '@/platform/ui/controls/modula-tag-input'
import {ModulaTextInput} from '@/platform/ui/controls/modula-text-input'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function ModuleFieldRenderer({
  moduleId,
  field,
  value,
  error,
  onChange,
}: {
  moduleId: string
  field: GreenfieldModuleFieldDefinition
  value: unknown
  error?: string
  onChange: (value: unknown) => void
}) {
  const {colours, controls, spacing} = useThemeTokens()
  const label = field.required ? `${field.label} *` : field.label

  if (field.type === 'boolean') {
    return (
      <ModulaFieldShell support={field.helpText} error={error}>
        <View
          style={{
            alignItems: 'center',
            flexDirection: 'row',
            gap: spacing[3],
            justifyContent: 'space-between',
            minHeight: controls.listRow.minimum,
          }}>
          <AppText variant="body">{label}</AppText>
          <Switch
            accessibilityLabel={label}
            value={Boolean(value)}
            onValueChange={onChange}
            trackColor={{false: colours.border, true: colours.accentSubtle}}
            thumbColor={value ? colours.accent : colours.textMuted}
          />
        </View>
      </ModulaFieldShell>
    )
  }

  if (field.type === 'singleSelect') {
    return (
      <ModulaFieldShell label={label} support={field.helpText} error={error}>
        <ModulaSelectField
          accessibilityLabel={label}
          allowClear={!field.required}
          onChange={onChange}
          options={field.options ?? []}
          placeholder={field.placeholder}
          sheetTitle={field.label}
          value={typeof value === 'string' ? value : undefined}
        />
      </ModulaFieldShell>
    )
  }

  if (field.type === 'recordReference') {
    return (
      <ModuleRecordReferenceField
        moduleId={moduleId}
        field={field}
        label={label}
        value={value}
        error={error}
        onChange={onChange}
      />
    )
  }

  if (field.type === 'tags' || field.type === 'multiSelect') {
    return (
      <ModulaFieldShell label={label} support={field.helpText} error={error}>
        <ModulaTagInput
          accessibilityLabel={label}
          value={Array.isArray(value) ? value.map(String) : []}
          onChange={onChange}
          placeholder={field.placeholder}
        />
      </ModulaFieldShell>
    )
  }

  const multiline = field.type === 'multilineText' || field.type === 'richText' || field.type === 'json'
  const textValue = field.type === 'richText'
    ? richTextEditingText(value)
    : field.type === 'json'
      ? value === undefined
        ? ''
        : JSON.stringify(value, null, 2)
      : field.type === 'number'
        ? typeof value === 'number'
          ? String(value)
          : ''
        : typeof value === 'string'
          ? value
          : ''

  return (
    <ModulaFieldShell label={label} support={field.helpText} error={error}>
      <ModulaTextInput
        accessibilityLabel={label}
        value={textValue}
        onChangeText={text => {
          if (field.type === 'richText') onChange(richTextDocumentFromText(text))
          else if (field.type === 'json') {
            try {
              onChange(text.trim() ? JSON.parse(text) : {})
            } catch {
              onChange(text)
            }
          } else if (field.type === 'number') {
            const parsed = Number(text)
            onChange(text.trim() === '' ? undefined : Number.isFinite(parsed) ? parsed : text)
          } else onChange(text)
        }}
        placeholder={field.placeholder ?? defaultPlaceholder(field.type)}
        keyboardType={field.type === 'number' ? 'numeric' : 'default'}
        multiline={multiline}
        style={error ? {borderColor: colours.destructive} : undefined}
      />
    </ModulaFieldShell>
  )
}

function ModuleRecordReferenceField({
  moduleId,
  field,
  label,
  value,
  error,
  onChange,
}: {
  moduleId: string
  field: GreenfieldModuleFieldDefinition
  label: string
  value: unknown
  error?: string
  onChange: (value: unknown) => void
}) {
  const collection = field.referenceCollection ?? ''
  const records = useModuleRecordsQuery(moduleId, collection)
  const options = (records.data?.items ?? []).map(record => ({
    value: record.record_id,
    label: String(record.data.title ?? record.data.name ?? record.data.label ?? 'Untitled'),
  }))

  return (
    <ModulaFieldShell label={label} support={field.helpText} error={error}>
      <ModulaSelectField
        accessibilityLabel={label}
        allowClear={!field.required}
        loading={records.isPending && Boolean(collection)}
        onChange={onChange}
        options={options}
        placeholder={field.placeholder ?? 'Choose a record'}
        sheetTitle={field.label}
        value={typeof value === 'string' ? value : undefined}
      />
    </ModulaFieldShell>
  )
}

function defaultPlaceholder(type: GreenfieldModuleFieldDefinition['type']): string | undefined {
  if (type === 'number') return '0'
  return undefined
}
