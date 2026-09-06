import {forwardRef, useRef} from 'react'
import {
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInput as RNTextInput,
  type ViewStyle,
} from 'react-native'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {ModulaIcon} from '@/platform/ui/icons'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type ModulaSearchFieldProps = {
  value: string
  onChangeText: (text: string) => void
  placeholder?: string
  onSubmitEditing?: () => void
  autoFocus?: boolean
  editable?: boolean
  variant?: 'compact' | 'navigation' | 'screen' | 'settings' | 'product' | 'module'
  onActivate?: () => void
  onCancel?: () => void
  onEscape?: () => void
  autoCorrect?: boolean
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters'
  accessibilityLabel?: string
  style?: StyleProp<ViewStyle>
  testID?: string
}

/** Canonical search entry: leading glyph, single-line input, labelled clear. */
export const ModulaSearchField = forwardRef<RNTextInput, ModulaSearchFieldProps>(function ModulaSearchField({
  value,
  onChangeText,
  placeholder = 'Search',
  onSubmitEditing,
  autoFocus,
  editable = true,
  variant = 'screen',
  onActivate,
  onCancel,
  onEscape,
  autoCorrect,
  autoCapitalize,
  accessibilityLabel,
  style,
  testID,
}: ModulaSearchFieldProps, forwardedRef) {
  const {accessibility, colours, controls, radius, spacing, typography} = useThemeTokens()
  const inputRef = useRef<RNTextInput>(null)

  const compact = variant === 'compact' || variant === 'navigation'
  const activationOnly = !editable && Boolean(onActivate)
  const content = (
    <View
      style={[
        styles.root,
        {
          backgroundColor: colours.surfaceRaised,
          borderColor: colours.border,
          borderRadius: compact ? radius.round : radius.large,
          paddingHorizontal: spacing[3],
          gap: spacing[2],
          minHeight: controls.inputHeight.search,
        },
        style,
      ]}>
      <ModulaIcon name="search" size={18} colour={colours.textTertiary} />
      {activationOnly ? (
        <AppText
          colour={value ? 'text' : 'textSecondary'}
          numberOfLines={1}
          style={styles.activationCopy}
          testID={testID}
          variant="body">
          {value || placeholder}
        </AppText>
      ) : (
        <TextInput
          ref={node => {
            inputRef.current = node
            if (typeof forwardedRef === 'function') forwardedRef(node)
            else if (forwardedRef) forwardedRef.current = node
          }}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colours.textTertiary}
          onSubmitEditing={onSubmitEditing}
          onKeyPress={event => {
            if (event.nativeEvent.key === 'Escape') onEscape?.()
          }}
          autoFocus={autoFocus}
          editable={editable}
          autoCorrect={autoCorrect}
          autoCapitalize={autoCapitalize}
          returnKeyType="search"
          accessibilityLabel={accessibilityLabel ?? placeholder}
          role="searchbox"
          allowFontScaling={accessibility.followSystemTextSize}
          testID={testID}
          style={[styles.input, {color: colours.text, ...typography.body}]}
        />
      )}
      {value.length > 0 ? (
        <AppPressable
          onPress={() => {
            onChangeText('')
            inputRef.current?.focus()
          }}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          style={styles.iconTarget}
          testID={testID ? `${testID}-clear` : undefined}>
          <ModulaIcon name="close" size={16} colour={colours.textSecondary} />
        </AppPressable>
      ) : null}
      {onCancel ? (
        <AppPressable
          accessibilityLabel="Cancel search"
          accessibilityRole="button"
          onPress={onCancel}
          style={styles.cancelTarget}
          testID={testID ? `${testID}-cancel` : undefined}>
          <AppText variant="buttonLabel">Cancel</AppText>
        </AppPressable>
      ) : null}
    </View>
  )

  if (activationOnly) {
    return (
      <AppPressable
        accessibilityLabel={accessibilityLabel ?? placeholder}
        accessibilityRole="button"
        onPress={onActivate}>
        {content}
      </AppPressable>
    )
  }
  return content
})

const styles = StyleSheet.create({
  activationCopy: {
    flex: 1,
  },
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    paddingVertical: 10,
  },
  cancelTarget: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  iconTarget: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 32,
  },
})
