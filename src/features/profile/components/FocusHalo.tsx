import type {ReactNode} from 'react'
import {StyleSheet, View} from 'react-native'

import {AppText} from '@/components/primitives/AppText'
import type {FocusStatus} from '@/features/profile/contracts/presence'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type FocusHaloProps = {
  status: FocusStatus
  profileName: string
  size: number
  children: ReactNode
  visible?: boolean
}

export function FocusHalo({
  status,
  profileName,
  size,
  children,
  visible = true,
}: FocusHaloProps) {
  const {colours, radius, spacing} = useThemeTokens()
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
      style={{width: size + 12}}>
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
      <View
        style={[
          styles.label,
          {
            backgroundColor: colours.surfaceRaised,
            borderColor: ringColour,
            borderRadius: radius.round,
            paddingHorizontal: spacing[2],
          },
        ]}>
        <AppText variant="micro" numberOfLines={1}>
          {status.label}
        </AppText>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  label: {
    alignSelf: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    marginTop: -12,
    minHeight: 24,
  },
  ring: {
    alignItems: 'center',
    borderWidth: 3,
    justifyContent: 'center',
  },
})
