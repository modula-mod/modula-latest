import {View, type StyleProp, type ViewStyle} from 'react-native'

import type {ModulaButtonRole} from '@/platform/ui/buttons/button-role'
import {KonstaButton} from '@/platform/ui/adapters/konsta/button.web'

export type ModulaButtonProps = {
  label: string
  onPress?: () => void
  role?: ModulaButtonRole
  disabled?: boolean
  loading?: boolean
  fullWidth?: boolean
  size?: 'compact' | 'regular' | 'prominent'
  accessibilityLabel?: string
  style?: StyleProp<ViewStyle>
  testID?: string
}

/** DOM-native web button with compact paint geometry and a 44px hit target. */
export function ModulaButton({
  label,
  onPress,
  role = 'primary',
  disabled = false,
  loading = false,
  fullWidth = false,
  size,
  accessibilityLabel,
  style,
  testID,
}: ModulaButtonProps) {
  const blocked = disabled || loading
  const resolvedSize = size ?? (role === 'quiet' || role === 'plain' || role === 'inline' ? 'compact' : 'regular')
  return (
    <View style={[{alignSelf: fullWidth ? 'stretch' : 'flex-start'}, style]}>
      <div className="modula-konsta-button-target" data-full-width={String(fullWidth)}>
        <KonstaButton
          accessibilityLabel={accessibilityLabel ?? label}
          disabled={blocked}
          label={label}
          loading={loading}
          onPress={onPress}
          role={role}
          size={resolvedSize}
          testID={testID}
        />
      </div>
    </View>
  )
}
