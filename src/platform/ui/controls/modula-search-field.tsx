import {useRef} from 'react'
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInput as RNTextInput,
  type ViewStyle,
} from 'react-native'

import {ModulaIcon} from '@/platform/ui/icons'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type ModulaSearchFieldProps = {
  value: string
  onChangeText: (text: string) => void
  placeholder?: string
  onSubmitEditing?: () => void
  autoFocus?: boolean
  editable?: boolean
  accessibilityLabel?: string
  style?: StyleProp<ViewStyle>
  testID?: string
}

/** Canonical search entry: leading glyph, single-line input, labelled clear. */
export function ModulaSearchField({
  value,
  onChangeText,
  placeholder = 'Search',
  onSubmitEditing,
  autoFocus,
  editable = true,
  accessibilityLabel,
  style,
  testID,
}: ModulaSearchFieldProps) {
  const {accessibility, colours, controls, radius, spacing, typography} = useThemeTokens()
  const inputRef = useRef<RNTextInput>(null)

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: colours.surfaceRaised,
          borderColor: colours.border,
          borderRadius: radius.large,
          paddingHorizontal: spacing[3],
          gap: spacing[2],
          minHeight: controls.inputHeight.search,
        },
        style,
      ]}>
      <ModulaIcon name="search" size={18} colour={colours.textTertiary} />
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colours.textTertiary}
        onSubmitEditing={onSubmitEditing}
        autoFocus={autoFocus}
        editable={editable}
        returnKeyType="search"
        accessibilityLabel={accessibilityLabel ?? placeholder}
        accessibilityRole="search"
        allowFontScaling={accessibility.followSystemTextSize}
        testID={testID}
        style={[styles.input, {color: colours.text, ...typography.body}]}
      />
      {value.length > 0 ? (
        <Pressable
          onPress={() => {
            onChangeText('')
            inputRef.current?.focus()
          }}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          hitSlop={8}
          testID={testID ? `${testID}-clear` : undefined}>
          <ModulaIcon name="close" size={16} colour={colours.textSecondary} />
        </Pressable>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    paddingVertical: 10,
  },
})
