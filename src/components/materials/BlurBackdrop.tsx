import type {ComponentProps} from 'react'
import {BlurView} from 'expo-blur'

type BlurBackdropProps = Pick<
  ComponentProps<typeof BlurView>,
  'intensity' | 'tint' | 'style'
>

export function BlurBackdrop({intensity, tint, style}: BlurBackdropProps) {
  return <BlurView intensity={intensity} tint={tint} style={style} />
}
