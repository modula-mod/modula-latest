import {Switch, TextInput, View} from 'react-native'
import type {GreenfieldModuleFieldDefinition} from '@modula/greenfield-module-ui-contracts'

import {AppText} from '@/components/primitives/AppText'
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
  return (
    <View style={{gap: spacing[1]}}>
      <AppText variant="caption" colour="textSecondary">{field.label}</AppText>
      <TextInput
        accessibilityLabel={field.label}
        value={Array.isArray(value) ? value.join(', ') : typeof value === 'string' ? value : ''}
        onChangeText={text => onChange(field.type === 'tags' || field.type === 'multiSelect' ? text.split(',').map(item => item.trim()).filter(Boolean) : text)}
        placeholder={field.placeholder}
        placeholderTextColor={colours.textTertiary}
        multiline={field.type === 'multilineText'}
        style={{
          backgroundColor: colours.surface,
          borderColor: colours.border,
          borderRadius: radius.medium,
          borderWidth: 1,
          color: colours.text,
          minHeight: field.type === 'multilineText' ? 112 : 44,
          padding: spacing[3],
        }}
      />
      {field.helpText ? <AppText variant="micro" colour="textTertiary">{field.helpText}</AppText> : null}
    </View>
  )
}
