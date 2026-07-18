import type {ReactElement, ReactNode} from 'react'
import {StyleSheet, View, type StyleProp, type ViewStyle} from 'react-native'
import {BlurView} from 'expo-blur'
import {CameraView} from 'expo-camera'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {useModulaCameraPermission} from '@/platform/ui/camera/useModulaCameraPermission'
import {MaskedView} from '@/platform/ui/materials/masked-view'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type CameraMaskedBlurSurfaceProps = {
  maskElement: ReactElement
  children?: ReactNode
  style?: StyleProp<ViewStyle>
  blurIntensity?: number
  active?: boolean
}

/**
 * Live camera feed cut through UI glyphs (Motionary masked-blur technique).
 * Uses Modula MaskedView adapter — not a direct `@react-native-masked-view` dep.
 */
export function CameraMaskedBlurSurface({
  maskElement,
  children,
  style,
  blurIntensity = 48,
  active = true,
}: CameraMaskedBlurSurfaceProps) {
  const {colours, spacing, radius, scheme} = useThemeTokens()
  const {status, isReady, requestPermission} = useModulaCameraPermission(active)

  if (!active) {
    return (
      <View
        style={[
          styles.shell,
          {
            backgroundColor: colours.surface1,
            borderColor: colours.border,
            borderRadius: radius.large,
            padding: spacing[4],
          },
          style,
        ]}>
        <AppText variant="caption" colour="textTertiary">
          Enable Camera masked blur to preview the living backdrop.
        </AppText>
        {children}
      </View>
    )
  }

  if (!isReady) {
    return (
      <View
        style={[
          styles.shell,
          {
            backgroundColor: colours.surface1,
            borderColor: colours.border,
            borderRadius: radius.large,
            padding: spacing[4],
            gap: spacing[3],
          },
          style,
        ]}>
        <AppText variant="label">Camera access</AppText>
        <AppText variant="caption" colour="textTertiary">
          {status === 'blocked'
            ? 'Camera permission is blocked. Enable it in system Settings to preview this effect.'
            : 'Modula needs the camera for this Appearance Advanced Preview. Nothing is recorded or uploaded.'}
        </AppText>
        {status === 'denied' || status === 'loading' ? (
          <AppPressable
            accessibilityLabel="Allow camera access"
            onPress={() => void requestPermission()}
            style={[
              styles.permissionButton,
              {
                backgroundColor: colours.accentSubtle,
                borderColor: colours.accent,
                borderRadius: radius.round,
              },
            ]}>
            <AppText variant="label" style={{color: colours.accent}}>
              Allow camera
            </AppText>
          </AppPressable>
        ) : null}
        {children}
      </View>
    )
  }

  return (
    <View
      style={[
        styles.shell,
        {
          backgroundColor: colours.canvas,
          borderColor: colours.border,
          borderRadius: radius.large,
        },
        style,
      ]}>
      <MaskedView style={styles.masked} maskElement={maskElement}>
        <BlurView
          intensity={blurIntensity}
          tint={scheme === 'dark' ? 'dark' : 'light'}
          style={styles.blur}
        />
        <BlurView
          intensity={Math.max(12, Math.round(blurIntensity * 0.45))}
          tint={scheme === 'dark' ? 'dark' : 'light'}
          style={styles.blur}
        />
        <CameraView style={styles.camera} facing="back" mirror={false} />
      </MaskedView>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  blur: {
    ...StyleSheet.absoluteFill,
    zIndex: 3,
  },
  camera: {
    ...StyleSheet.absoluteFill,
    zIndex: 2,
  },
  masked: {
    ...StyleSheet.absoluteFill,
  },
  permissionButton: {
    alignSelf: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  shell: {
    minHeight: 240,
    overflow: 'hidden',
    width: '100%',
  },
})
