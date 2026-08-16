import type {ReactNode} from 'react'
import {StyleSheet, View} from 'react-native'

import type {FocusStatus} from '@/features/profile/contracts/presence'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type FocusHaloProps = {
  status: FocusStatus
  profileName: string
  size: number
  children: ReactNode
  visible?: boolean
}

/**
 * Availability ring only — no overlapping status chip.
 * Customize copy: a small ring around the avatar, not a second badge on Edit Profile.
 */
export function FocusHalo({
  status,
  profileName,
  size,
  children,
  visible = true,
}: FocusHaloProps) {
  const {colours} = useThemeTokens()
  const ringColour =
    status.id === 'available'
      ? colours.success
      : status.id === 'focused'
        ? colours.focusRing
        : status.id === 'busy'
          ? colours.warning
          : status.id === 'doNotDisturb'
            ? colours.destructive
            : status.id === 'live'
              ? colours.info
              : colours.textMuted

  if (!visible) {
    return <View accessibilityLabel={`${profileName} avatar`}>{children}</View>
  }

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={`${profileName}, ${status.label}. Focus status: ${status.label}`}
      style={{width: size + 12, height: size + 12}}>
      <View
        style={[
          styles.ring,
          {
            borderColor: ringColour,
            borderRadius: (size + 12) / 2,
            height: size + 12,
            width: size + 12,
          },
        ]}>
        {children}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  ring: {
    alignItems: 'center',
    borderWidth: 3,
    justifyContent: 'center',
  },
})
