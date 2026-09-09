import {View} from 'react-native'

import {ModulaIcon} from '@/platform/ui/icons'
import {KonstaChip} from '@/platform/ui/adapters/konsta/chip.web'
import type {ModulaChipProps} from '@/platform/ui/controls/modula-chip'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function ModulaChip({
  disabled,
  filter = false,
  label,
  onPress,
  selected = false,
  style,
  testID,
}: ModulaChipProps) {
  const {colours} = useThemeTokens()
  return (
    <View style={style}>
      <KonstaChip
        disabled={disabled}
        label={label}
        media={filter && selected ? <ModulaIcon name="check" colour={colours.accent} size={14} /> : undefined}
        onPress={onPress}
        selected={selected}
        testID={testID}
      />
    </View>
  )
}

export const ModulaFilterChip = (props: Omit<ModulaChipProps, 'filter'>) => (
  <ModulaChip {...props} filter />
)
