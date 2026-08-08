import {Host, List, ListItem, FieldGroup, Text} from '@expo/ui'
import type {ReactNode} from 'react'
import type {StyleProp, ViewStyle} from 'react-native'

import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type ModulaListProps = {
  children: ReactNode
  style?: StyleProp<ViewStyle>
  testID?: string
}

export type ModulaListItemProps = {
  title: string
  supportingText?: string
  onPress?: () => void
  leading?: ReactNode
  trailing?: ReactNode
  testID?: string
}

export type ModulaFieldGroupProps = {
  children: ReactNode
  style?: StyleProp<ViewStyle>
  testID?: string
}

export type ModulaFieldSectionProps = {
  title?: string
  children: ReactNode
  testID?: string
}

/** Native Expo UI List host. */
export function ModulaList({children, style, testID}: ModulaListProps) {
  const {colours, scheme} = useThemeTokens()
  return (
    <Host
      colorScheme={scheme}
      seedColor={colours.accent}
      style={[{alignSelf: 'stretch', flex: 1}, style]}
      testID={testID}>
      <List>{children}</List>
    </Host>
  )
}

export function ModulaListItem({
  title,
  supportingText,
  onPress,
  leading,
  trailing,
  testID,
}: ModulaListItemProps) {
  return (
    <ListItem
      onPress={onPress}
      leading={leading}
      trailing={trailing}
      supportingText={supportingText}
      testID={testID}>
      <Text>{title}</Text>
    </ListItem>
  )
}

/** Native FieldGroup for settings-style forms. */
export function ModulaFieldGroup({children, style, testID}: ModulaFieldGroupProps) {
  const {colours, scheme} = useThemeTokens()
  return (
    <Host
      colorScheme={scheme}
      seedColor={colours.accent}
      style={[{alignSelf: 'stretch', flex: 1}, style]}
      testID={testID}>
      <FieldGroup>{children}</FieldGroup>
    </Host>
  )
}

export function ModulaFieldSection({title, children, testID}: ModulaFieldSectionProps) {
  return (
    <FieldGroup.Section title={title} testID={testID}>
      {children}
    </FieldGroup.Section>
  )
}
