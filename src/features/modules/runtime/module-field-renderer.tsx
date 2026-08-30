import {Switch, TextInput, View} from 'react-native'
import type {GreenfieldModuleFieldDefinition} from '@modula/greenfield-module-ui-contracts'

import {AppText} from '@/components/primitives/AppText'
import {richTextDocumentFromText, richTextEditingText} from '@/features/modules/runtime/mps-frontend-adapter'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function ModuleFieldRenderer({
  field,
  value,
  onChange,
}: {
  field: GreenfieldModuleFieldDefinition
  value: unknown
  onChange: (value: unknown) => void
}) {
  const {colours, radius, spacing} = useThemeTokens()
  if (field.type === 'boolean') {
    return (
      <View style={{alignItems: 'center', flexDirection: 'row', gap: spacing[3], justifyContent: 'space-between'}}>
        <AppText variant="label">{field.label}</AppText>
        <Switch
          accessibilityLabel={field.label}
          value={Boolean(value)}
          onValueChange={onChange}
          trackColor={{false: colours.border, true: colours.accentSubtle}}
          thumbColor={value ? colours.accent : colours.textMuted}
        />
      </View>
    )
  }
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
      : Array.isArray(value)
      ? value.join(', ')
      : typeof value === 'string'
        ? value
        : ''
  return (
    <View style={{gap: spacing[1]}}>
      <AppText variant="caption" colour="textSecondary">{field.label}</AppText>
      <TextInput
        accessibilityLabel={field.label}
        value={textValue}
        onChangeText={text => {
          if (field.type === 'richText') onChange(richTextDocumentFromText(text))
          else if (field.type === 'tags' || field.type === 'multiSelect') onChange(text.split(',').map(item => item.trim()).filter(Boolean))
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
        placeholder={field.placeholder}
        placeholderTextColor={colours.textTertiary}
        keyboardType={field.type === 'number' ? 'numeric' : 'default'}
        multiline={field.type === 'multilineText' || field.type === 'richText' || field.type === 'json'}
        style={{
          backgroundColor: colours.surface,
          borderColor: colours.border,
          borderRadius: radius.medium,
          borderWidth: 1,
          color: colours.text,
          minHeight: field.type === 'multilineText' || field.type === 'richText' || field.type === 'json' ? 112 : 44,
          padding: spacing[3],
        }}
      />
      {field.helpText ? <AppText variant="micro" colour="textTertiary">{field.helpText}</AppText> : null}
    </View>
  )
}
