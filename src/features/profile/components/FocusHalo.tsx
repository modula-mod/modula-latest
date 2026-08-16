import type {ReactNode} from 'react'
import {StyleSheet, View} from 'react-native'

import type {FocusStatus} from '@/features/profile/contracts/presence'
import {PROFILE_LAYOUT} from '@/features/profile/model/profile-layout'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type FocusHaloProps = {
  status: FocusStatus
  profileName: string
  size: number
  children: ReactNode
  visible?: boolean
}

/**
 * Focus Halo 2.0 — compact availability ring around the avatar.
 * Colour follows Focus status. No pulse, no second badge.
 */
export function FocusHalo({
  status,
  profileName,
  size,
  children,
  visible = true,
}: FocusHaloProps) {
  const {colours} = useThemeTokens()
  const extra = PROFILE_LAYOUT.haloExtra
  const ringColour = colourForStatus(status.id, colours)
  const label = `${profileName}, ${status.label}`

  if (!visible || status.id === 'private') {
    return (
      <View accessibilityLabel={`${profileName} avatar`} style={{width: size, height: size}}>
        {children}
      </View>
    )
  }

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={`${label}. Focus status: ${status.label}`}
      style={{width: size + extra, height: size + extra}}>
      <View
        style={[
          styles.ring,
          {
            borderColor: ringColour,
            borderRadius: (size + extra) / 2,
            height: size + extra,
            width: size + extra,
          },
        ]}>
        {children}
      </View>
    </View>
  )
}

function colourForStatus(
  id: FocusStatus['id'],
  colours: {
    success: string
    focusRing: string
    warning: string
    destructive: string
    info: string
    textMuted: string
  },
): string {
  if (id === 'available') return colours.success
  if (id === 'focused') return colours.focusRing
  if (id === 'busy') return colours.warning
  if (id === 'doNotDisturb') return colours.destructive
  if (id === 'live') return colours.info
  return colours.textMuted
}

const styles = StyleSheet.create({
  ring: {
    alignItems: 'center',
    borderWidth: 2,
    justifyContent: 'center',
  },
})
