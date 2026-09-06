import type {ReactNode} from 'react'
import {View, type StyleProp, type TextStyle, type ViewStyle} from 'react-native'

import {Surface} from '@/components/primitives/Surface'
import {ModulaActionButton} from '@/platform/ui/buttons/modula-action-button'
import {ModulaIconButton} from '@/platform/ui/buttons/modula-icon-button'
import {ModulaTextInput} from '@/platform/ui/controls/modula-text-input'
import type {ModulaIconName} from '@/platform/ui/icons/modula-icon-registry'
import {ModulaToolbar} from '@/platform/ui/toolbars'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function ModulaComposerShell({children, style}: {children: ReactNode; style?: StyleProp<ViewStyle>}) {
  const {spacing} = useThemeTokens()
  return <View style={[{alignSelf: 'stretch', gap: spacing[4]}, style]}>{children}</View>
}

export function ModulaComposerInput({
  value,
  onChangeText,
  placeholder = 'What are you building?',
  accessibilityLabel = 'Post text',
  autoFocus,
  style,
  textStyle,
}: {
  value: string
  onChangeText: (value: string) => void
  placeholder?: string
  accessibilityLabel?: string
  autoFocus?: boolean
  style?: StyleProp<ViewStyle>
  textStyle?: StyleProp<TextStyle>
}) {
  return (
    <ModulaTextInput
      accessibilityLabel={accessibilityLabel}
      autoFocus={autoFocus}
      chrome="plain"
      multiline
      onChangeText={onChangeText}
      placeholder={placeholder}
      style={style}
      textStyle={textStyle}
      value={value}
    />
  )
}

export const ModulaComposerToolbar = ({children}: {children: ReactNode}) => (
  <ModulaToolbar variant="editor">{children}</ModulaToolbar>
)

export function ModulaComposerAttachment({children}: {children: ReactNode}) {
  const {spacing} = useThemeTokens()
  return <Surface variant="inset" style={{padding: spacing[3]}}>{children}</Surface>
}

export const ModulaComposerToolButton = ({
  icon,
  label,
  onPress,
}: {
  icon: ModulaIconName
  label: string
  onPress: () => void
}) => <ModulaIconButton accessibilityLabel={label} icon={icon} onPress={onPress} />

export const ModulaComposerAudience = ({label, onPress}: {label: string; onPress: () => void}) => (
  <ModulaActionButton icon="people" label={label} onPress={onPress} />
)
