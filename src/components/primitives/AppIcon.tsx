import {
  ModulaIcon,
  type ModulaIconName,
} from '@/platform/ui/icons'

/**
 * Compatibility name for existing shell consumers.
 *
 * Rendering is delegated to the canonical semantic registry: SF Symbols on
 * iOS and Modula-owned SVG paths on Android/web. No icon font is loaded.
 */
export type AppIconName = ModulaIconName

type AppIconProps = {
  name: AppIconName
  size?: number
  colour: string
}

export function AppIcon({name, size = 22, colour}: AppIconProps) {
  return <ModulaIcon name={name} size={size} colour={colour} />
}
