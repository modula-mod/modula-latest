import {forwardRef} from 'react'
import {Pressable, View, type TextInput as RNTextInput} from 'react-native'

import {AppText} from '@/components/primitives/AppText'
import {KonstaSearchbar} from '@/platform/ui/adapters/konsta/searchbar.web'
import type {ModulaSearchFieldProps} from '@/platform/ui/controls/modula-search-field'

export const ModulaSearchField = forwardRef<RNTextInput, ModulaSearchFieldProps>(function ModulaSearchField({
  accessibilityLabel,
  autoCapitalize,
  autoCorrect,
  autoFocus,
  editable = true,
  onActivate,
  onCancel,
  onChangeText,
  onEscape,
  onSubmitEditing,
  placeholder = 'Search',
  style,
  testID,
  value,
}: ModulaSearchFieldProps, forwardedRef) {
  if (!editable && onActivate) {
    return (
      <Pressable
        accessibilityLabel={accessibilityLabel ?? placeholder}
        accessibilityRole="button"
        onPress={onActivate}
        style={[{minHeight: 44, justifyContent: 'center'}, style]}
        testID={testID}>
        <AppText colour={value ? 'text' : 'textSecondary'} numberOfLines={1} variant="body">
          {value || placeholder}
        </AppText>
      </Pressable>
    )
  }
  return (
    <View style={style}>
      <KonstaSearchbar
        accessibilityLabel={accessibilityLabel ?? placeholder}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        autoFocus={autoFocus}
        forwardedRef={forwardedRef}
        onCancel={onCancel}
        onChangeText={onChangeText}
        onEscape={onEscape}
        onSubmitEditing={onSubmitEditing}
        placeholder={placeholder}
        testID={testID}
        value={value}
      />
    </View>
  )
})
