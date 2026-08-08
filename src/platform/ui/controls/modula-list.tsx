import type {ReactNode} from 'react'
import {Pressable, View, type StyleProp, type ViewStyle} from 'react-native'

import {AppText} from '@/components/primitives/AppText'
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

/** Web / fallback list. */
export function ModulaList({children, style, testID}: ModulaListProps) {
  const {colours, radius, spacing} = useThemeTokens()
  return (
    <View
      testID={testID}
      style={[
        {
          alignSelf: 'stretch',
          backgroundColor: colours.surface,
          borderRadius: radius.large ?? 12,
          overflow: 'hidden',
          paddingVertical: spacing[1],
        },
        style,
      ]}>
      {children}
    </View>
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
  const {colours, spacing} = useThemeTokens()
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      style={{
        minHeight: 44,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[3],
        paddingHorizontal: spacing[4],
        paddingVertical: spacing[3],
        borderBottomWidth: StyleSheetHairline,
        borderBottomColor: colours.border,
      }}>
      {leading}
      <View style={{flex: 1, gap: 2}}>
        <AppText variant="body">{title}</AppText>
        {supportingText ? (
          <AppText variant="caption" colour="textSecondary">
            {supportingText}
          </AppText>
        ) : null}
      </View>
      {trailing}
    </Pressable>
  )
}

export function ModulaFieldGroup({children, style, testID}: ModulaFieldGroupProps) {
  return (
    <View testID={testID} style={[{alignSelf: 'stretch', gap: 16}, style]}>
      {children}
    </View>
  )
}

export function ModulaFieldSection({title, children, testID}: ModulaFieldSectionProps) {
  const {spacing} = useThemeTokens()
  return (
    <View testID={testID} style={{gap: spacing[2]}}>
      {title ? (
        <AppText variant="caption" colour="textSecondary">
          {title.toUpperCase()}
        </AppText>
      ) : null}
      <ModulaList>{children}</ModulaList>
    </View>
  )
}

const StyleSheetHairline = 1 / 2
