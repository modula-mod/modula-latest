import {useMemo, useState} from 'react'
import {View} from 'react-native'

import {AppText} from '@/components/primitives/AppText'
import {ModuleLoadingState} from '@/features/modules/runtime/module-loading-state'
import {ModuleEmptyState} from '@/features/modules/runtime/module-empty-state'
import {useModuleSettingsQuery, useModuleSettingsSchemaQuery} from '@/features/modules/hooks'
import {ModuleFieldRenderer} from '@/features/modules/runtime/module-field-renderer'
import {ModulaButton} from '@/platform/ui/buttons/modula-button'
import {useAppServices} from '@/runtime/useAppServices'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function SchemaSettingsRenderer({moduleId}: {moduleId: string}) {
  const {moduleRepository} = useAppServices()
  const {spacing} = useThemeTokens()
  const settings = useModuleSettingsQuery(moduleId)
  const schema = useModuleSettingsSchemaQuery(moduleId)
  const [draft, setDraft] = useState<Record<string, unknown>>({})
  const values = useMemo(
    () => ({...(schema.data?.defaults ?? {}), ...(settings.data?.values ?? {}), ...draft}),
    [draft, schema.data?.defaults, settings.data?.values],
  )
  const save = () => {
    void moduleRepository.updateSettings(moduleId, values).then(() => {
      setDraft({})
      void settings.refetch()
    })
  }
  if (settings.isPending || schema.isPending) return <ModuleLoadingState label="Loading module settings" />
  if (!schema.data?.fields.length) {
    return (
      <ModuleEmptyState
        title="No configurable settings"
        body="This module has not registered account settings for the installed version."
      />
    )
  }
  return (
    <View style={{gap: spacing[3]}}>
      <AppText variant="headline">Module settings</AppText>
      {schema.data.fields.map(field => (
        <ModuleFieldRenderer
          key={field.fieldId}
          moduleId={moduleId}
          field={field}
          value={values[field.name]}
          onChange={value => setDraft(current => ({...current, [field.name]: value}))}
        />
      ))}
      <ModulaButton label="Save settings" accessibilityLabel="Save module settings" size="prominent" onPress={save} />
    </View>
  )
}
