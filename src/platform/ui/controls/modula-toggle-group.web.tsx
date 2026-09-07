import {useRef, type KeyboardEvent} from 'react'

import type {ModulaToggleGroupProps} from '@/platform/ui/controls/modula-toggle-group.types'
import {useSystemAccessibility} from '@/theme/accessibility/useSystemAccessibility'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'
import {modulaWebCssVariables} from '@/platform/web-ui/theme'

export type {ModulaToggleGroupItem, ModulaToggleGroupProps} from '@/platform/ui/controls/modula-toggle-group.types'

/** Dense browser toolbar with pressed semantics and roving arrow-key focus. */
export function ModulaToggleGroup({
  items,
  value,
  onValueChange,
  selectionMode = 'multiple',
  accessibilityLabel = 'Options',
  disabled,
  testID,
}: ModulaToggleGroupProps) {
  const tokens = useThemeTokens()
  const {reduceTransparency} = useSystemAccessibility()
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const select = (id: string) => {
    if (selectionMode === 'single') return onValueChange(value.includes(id) ? [] : [id])
    onValueChange(value.includes(id) ? value.filter(item => item !== id) : [...value, id])
  }
  const move = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const enabled = items.map((item, itemIndex) => ({item, itemIndex})).filter(entry => !disabled && !entry.item.disabled)
    const current = enabled.findIndex(entry => entry.itemIndex === index)
    const next = event.key === 'Home'
      ? enabled[0]
      : event.key === 'End'
        ? enabled.at(-1)
        : enabled[(current + (event.key === 'ArrowRight' ? 1 : -1) + enabled.length) % enabled.length]
    if (next) refs.current[next.itemIndex]?.focus()
  }
  return (
    <div
      aria-label={accessibilityLabel}
      className="modula-web-ui modula-web-toggle-group"
      data-testid={testID}
      role="toolbar"
      style={modulaWebCssVariables(tokens, {reduceTransparency})}>
      {items.map((item, index) => (
        <button
          aria-label={item.accessibilityLabel}
          aria-pressed={value.includes(item.id)}
          className="modula-web-toggle-item"
          disabled={disabled || item.disabled}
          key={item.id}
          onClick={() => select(item.id)}
          onKeyDown={event => move(event, index)}
          ref={node => { refs.current[index] = node }}
          type="button">
          {item.label}
        </button>
      ))}
    </div>
  )
}
