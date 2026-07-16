import {View} from 'react-native'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {useTheme} from '@/theme/runtime/useTheme'

type AppChipProps = {
  label: string
  onPress?: () => void
  selected?: boolean
}

export function AppChip({label, onPress, selected}: AppChipProps) {
  const {colours, spacing, radius} = useTheme()
  const body = (
    <View
      style={{
        borderWidth: 1,
        borderColor: selected ? colours.accent : colours.border,
        backgroundColor: selected ? colours.accent : colours.surfaceRaised,
        borderRadius: radius.full,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
      }}>
      <AppText
        variant="caption"
        colour={selected ? 'accentForeground' : 'text'}>
        {label}
      </AppText>
    </View>
  )
  if (onPress) {
    return <AppPressable onPress={onPress}>{body}</AppPressable>
  }
  return body
}
