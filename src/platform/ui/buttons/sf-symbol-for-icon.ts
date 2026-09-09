import type {AppIconName} from '@/components/primitives/AppIcon'
import {modulaIconDefinition} from '@/platform/ui/icons/modula-icon-registry'

/** Every menu trigger consumes the same exhaustive semantic icon registry. */
export function sfSymbolForIcon(icon: AppIconName): string {
  return modulaIconDefinition(icon).sf
}
