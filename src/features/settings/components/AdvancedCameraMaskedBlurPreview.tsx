import {StyleSheet, View} from 'react-native'

import {AppText} from '@/components/primitives/AppText'
import {Avatar} from '@/components/primitives/Avatar'
import {CameraMaskedBlurSurface} from '@/platform/ui/materials/camera-masked-blur'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type AdvancedCameraMaskedBlurPreviewProps = {
  active: boolean
  disabledByTransparency: boolean
}

/**
 * Appearance → Advanced preview of Motionary camera masked-blur cutouts.
 */
export function AdvancedCameraMaskedBlurPreview({
  active,
  disabledByTransparency,
}: AdvancedCameraMaskedBlurPreviewProps) {
  const {colours, spacing} = useThemeTokens()
  const effectActive = active && !disabledByTransparency

  return (
    <CameraMaskedBlurSurface
      active={effectActive}
      style={styles.surface}
      maskElement={
        <View style={[styles.maskRoot, {padding: spacing[4], gap: spacing[4]}]}>
          <AppText
            variant="title1"
            style={[styles.maskInk, {color: colours.textMain}]}>
            Modula
          </AppText>
          <MaskRow
            name="Andrei"
            handle="@andrei.modula"
            colour="#369CAA"
          />
          <MaskRow name="Gaia" handle="@gaia.modula" colour="#5B7F95" />
          <MaskRow name="Design" handle="@design.modula" colour="#6A8F62" />
        </View>
      }>
      {disabledByTransparency && active ? (
        <View style={[styles.note, {padding: spacing[3]}]}>
          <AppText variant="caption" colour="textTertiary">
            Reduce Transparency is on — living blur chrome stays opaque until you
            turn it off.
          </AppText>
        </View>
      ) : null}
    </CameraMaskedBlurSurface>
  )
}

function MaskRow({
  name,
  handle,
  colour,
}: {
  name: string
  handle: string
  colour: string
}) {
  const {colours, spacing} = useThemeTokens()
  return (
    <View style={[styles.row, {gap: spacing[3]}]}>
      <Avatar name={name} colour={colour} size={44} />
      <View style={{gap: 2}}>
        <AppText variant="headline" style={[styles.maskInk, {color: colours.textMain}]}>
          {name}
        </AppText>
        <AppText
          variant="caption"
          style={[styles.maskInk, {color: colours.textSecondary}]}>
          {handle}
        </AppText>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  maskInk: {
    // Opaque ink → cutout in MaskedView
    opacity: 1,
  },
  maskRoot: {
    backgroundColor: 'transparent',
    flex: 1,
  },
  note: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  surface: {
    height: 280,
  },
})
