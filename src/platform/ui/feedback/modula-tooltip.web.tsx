import {Tooltip} from '@base-ui/react/tooltip'

import type {ModulaTooltipProps} from '@/platform/ui/feedback/modula-tooltip'
import {useSystemAccessibility} from '@/theme/accessibility/useSystemAccessibility'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'
import {modulaWebCssVariables} from '@/platform/web-ui/theme'

/** Supplemental hover/focus help for desktop icon controls. */
export function ModulaTooltip({children, label, disabled, side = 'top'}: ModulaTooltipProps) {
  const tokens = useThemeTokens()
  const {reduceTransparency} = useSystemAccessibility()
  return (
    <Tooltip.Provider delay={500} timeout={300}>
      <Tooltip.Root disabled={disabled}>
        <Tooltip.Trigger render={children} />
        <Tooltip.Portal>
          <Tooltip.Positioner className="modula-web-tooltip-positioner" side={side} sideOffset={6}>
            <Tooltip.Popup
              className="modula-web-ui modula-web-tooltip"
              style={modulaWebCssVariables(tokens, {reduceTransparency})}>
              {label}
            </Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  )
}
