import type {PropsWithChildren} from 'react'
import {StyleSheet, TextInput, type TextInputProps, View} from 'react-native'

import {AppButton} from '@/components/primitives/AppButton'
import {AppScreen} from '@/components/primitives/AppScreen'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function AuthShell({children}: PropsWithChildren) {
  const {spacing} = useThemeTokens()
  return (
    <AppScreen scroll style={[styles.shell, {padding: spacing[4]}]}>
      {children}
    </AppScreen>
  )
}

export function AuthPanel({children}: PropsWithChildren) {
  const {spacing} = useThemeTokens()
  return (
    <Surface variant="contained" style={[styles.panel, {gap: spacing[4], padding: spacing[4]}]}>
      {children}
    </Surface>
  )
}

export function AuthField({
  label,
  error,
  ...props
}: TextInputProps & {label: string; error?: string}) {
  const {colours, radius, spacing} = useThemeTokens()
  return (
    <View style={{gap: spacing[2]}}>
      <AppText variant="label">{label}</AppText>
      <TextInput
        {...props}
        accessibilityLabel={label}
        placeholderTextColor={colours.textTertiary}
        style={[
          styles.input,
          {
            borderColor: error ? colours.destructive : colours.border,
            backgroundColor: colours.surfaceRaised,
            borderRadius: radius.medium,
            color: colours.text,
            paddingHorizontal: spacing[3],
          },
          props.style,
        ]}
      />
      {error ? (
        <AppText variant="caption" colour="destructive">
          {error}
        </AppText>
      ) : null}
    </View>
  )
}

export {AppButton}

const styles = StyleSheet.create({
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 48,
  },
  panel: {
    width: '100%',
  },
  shell: {
    alignSelf: 'center',
    maxWidth: 560,
    width: '100%',
  },
})
