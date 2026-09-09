import {useRef, type KeyboardEvent} from 'react'
import {View, type StyleProp, type ViewStyle} from 'react-native'

import {useSystemAccessibility} from '@/theme/accessibility/useSystemAccessibility'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'
import {modulaWebCssVariables} from '@/platform/web-ui/theme'

export type ModulaTabPresentation = 'navigation' | 'segmented' | 'scrollable' | 'underline'
export type ModulaTabOption = {id: string; label: string; accessibilityLabel?: string; disabled?: boolean}
export type ModulaTabsProps = {
  tabs: ModulaTabOption[]
  value: string
  onValueChange: (value: string) => void
  presentation?: ModulaTabPresentation
  accessibilityLabel?: string
  segmentMinWidth?: number
  maxWidth?: number
  style?: StyleProp<ViewStyle>
  testID?: string
}

/** Browser-native tabs with roving focus and horizontal arrow navigation. */
export function ModulaTabs({
  tabs,
  value,
  onValueChange,
  presentation = 'segmented',
  accessibilityLabel = 'Tabs',
  segmentMinWidth,
  maxWidth,
  style,
  testID,
}: ModulaTabsProps) {
  const tokens = useThemeTokens()
  const {reduceTransparency} = useSystemAccessibility()
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const moveFocus = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const enabled = tabs.map((tab, tabIndex) => ({tab, tabIndex})).filter(entry => !entry.tab.disabled)
    const current = enabled.findIndex(entry => entry.tabIndex === index)
    const next = event.key === 'Home'
      ? enabled[0]
      : event.key === 'End'
        ? enabled.at(-1)
        : enabled[(current + (event.key === 'ArrowRight' ? 1 : -1) + enabled.length) % enabled.length]
    if (!next) return
    onValueChange(next.tab.id)
    refs.current[next.tabIndex]?.focus()
  }
  return (
    <View style={[{maxWidth}, style]}>
      <div
        className="modula-web-ui modula-web-tabs"
        data-presentation={presentation}
        style={modulaWebCssVariables(tokens, {reduceTransparency})}>
        <div aria-label={accessibilityLabel} className="modula-web-tabs-list" data-testid={testID} role="tablist">
          {tabs.map(tab => (
            <button
              aria-label={tab.accessibilityLabel}
              aria-selected={tab.id === value}
              className="modula-web-tabs-tab"
              data-active={tab.id === value ? 'true' : undefined}
              disabled={tab.disabled}
              key={tab.id}
              onClick={() => onValueChange(tab.id)}
              onKeyDown={event => moveFocus(event, tabs.indexOf(tab))}
              ref={node => { refs.current[tabs.indexOf(tab)] = node }}
              role="tab"
              style={segmentMinWidth ? {minWidth: segmentMinWidth} : undefined}
              tabIndex={tab.id === value ? 0 : -1}
              type="button">
              {tab.label}
            </button>
          ))}
        </div>
      </div>
    </View>
  )
}
