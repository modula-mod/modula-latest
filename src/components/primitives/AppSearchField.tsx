import {StyleSheet, TextInput, View, type TextInputProps} from 'react-native'

import {useTheme} from '@/theme/runtime/useTheme'

type AppSearchFieldProps = TextInputProps & {
  editable?: boolean
  containerStyle?: import('react-native').StyleProp<import('react-native').ViewStyle>
}

export function AppSearchField({
  style,
  containerStyle,
  editable = true,
  placeholderTextColor,
  ...rest
}: AppSearchFieldProps) {
  const {colours, spacing, radius} = useTheme()

  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: colours.surface,
          borderColor: colours.border,
          borderRadius: radius.lg,
          paddingHorizontal: spacing.md,
        },
        containerStyle,
      ]}>
      <TextInput
        editable={editable}
        placeholderTextColor={placeholderTextColor ?? colours.textSecondary}
        style={[
          {
            color: colours.text,
            paddingVertical: spacing.md,
            fontSize: 16,
          },
          style,
        ]}
        {...rest}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
  },
})
