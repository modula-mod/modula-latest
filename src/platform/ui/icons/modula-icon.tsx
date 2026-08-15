import {
  ModulaIconSvg,
  type ModulaIconProps,
} from '@/platform/ui/icons/modula-icon-svg'

export type {ModulaIconProps}

/**
 * Canonical Modula icon — web/default adapter renders the Modula-owned SVG
 * glyph. The native adapter lives in `modula-icon.native.tsx`.
 */
export function ModulaIcon(props: ModulaIconProps) {
  return <ModulaIconSvg {...props} />
}
