import {Combobox} from '@base-ui/react/combobox'
import {useId, useState} from 'react'

import {KonstaPopoverSurface} from '@/platform/ui/adapters/konsta/popover-surface.web'
import {ModulaDrawer} from '@/platform/ui/drawers/modula-drawer'
import {ModulaOverlayLayerScope, useModulaOverlayLayer} from '@/platform/ui/overlays/modula-overlay-stack'
import {useResponsivePresentation} from '@/platform/ui/responsive'
import {useSystemAccessibility} from '@/theme/accessibility/useSystemAccessibility'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'
import {modulaWebCssVariables} from '@/platform/web-ui/theme'

export type ModulaComboboxOption = {value: string; label: string; description?: string}
export type ModulaComboboxProps = {
  value?: string
  options: ModulaComboboxOption[]
  onChange: (value: string | undefined) => void
  label: string
  placeholder?: string
  disabled?: boolean
  noResultsLabel?: string
  testID?: string
}

export function ModulaCombobox({
  value,
  options,
  onChange,
  label,
  placeholder = 'Search choices',
  disabled,
  noResultsLabel = 'No matching choices.',
  testID,
}: ModulaComboboxProps) {
  const presentation = useResponsivePresentation('picker', {anchored: true})
  return presentation === 'drawer' ? (
    <TouchCombobox {...{value, options, onChange, label, placeholder, disabled, noResultsLabel, testID}} />
  ) : (
    <DesktopCombobox {...{value, options, onChange, label, placeholder, disabled, noResultsLabel, testID}} />
  )
}

function TouchCombobox({
  value,
  options,
  onChange,
  label,
  placeholder = 'Search choices',
  disabled,
  noResultsLabel = 'No matching choices.',
  testID,
}: ModulaComboboxProps) {
  const tokens = useThemeTokens()
  const {reduceTransparency} = useSystemAccessibility()
  const variables = modulaWebCssVariables(tokens, {reduceTransparency})
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const selected = options.find(option => option.value === value)
  const filtered = options.filter(option => `${option.label} ${option.description ?? ''}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  const close = () => { setOpen(false); setQuery('') }
  const choose = (next: string | undefined) => { onChange(next); close() }
  return (
    <div className="modula-web-combobox-touch">
      <span className="modula-web-combobox-label">{label}</span>
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        className="modula-web-ui modula-web-select-trigger"
        disabled={disabled}
        onClick={() => setOpen(true)}
        style={variables}
        type="button">
        <span>{selected?.label ?? placeholder}</span>
        <span aria-hidden="true">›</span>
      </button>
      <ModulaDrawer isPresented={open} onDismiss={close} presentation="picker" title={label}>
        <div className="modula-web-picker-search">
          <input
            aria-label={`Search ${label}`}
            autoComplete="off"
            autoFocus
            className="modula-web-input"
            data-testid={testID}
            onChange={event => setQuery(event.currentTarget.value)}
            placeholder={placeholder}
            type="search"
            value={query}
          />
        </div>
        <div className="modula-web-touch-actions" role="listbox" aria-label={label}>
          {value ? (
            <button className="modula-web-menu-item" onClick={() => choose(undefined)} role="option" type="button">
              <span aria-hidden="true" />
              <span className="modula-web-menu-label">Clear selection</span>
            </button>
          ) : null}
          {filtered.map(option => (
            <button
              aria-selected={option.value === value}
              className="modula-web-menu-item"
              key={option.value}
              onClick={() => choose(option.value)}
              role="option"
              type="button">
              <span className="modula-web-menu-indicator">{option.value === value ? '✓' : ''}</span>
              <span className="modula-web-menu-label">{option.label}</span>
              {option.description ? <span className="modula-web-menu-trailing">{option.description}</span> : null}
            </button>
          ))}
          {!filtered.length ? <div className="modula-web-select-empty">{noResultsLabel}</div> : null}
        </div>
      </ModulaDrawer>
    </div>
  )
}

function DesktopCombobox({
  value,
  options,
  onChange,
  label,
  placeholder = 'Search choices',
  disabled,
  noResultsLabel = 'No matching choices.',
  testID,
}: ModulaComboboxProps) {
  const id = useId()
  const tokens = useThemeTokens()
  const {reduceTransparency} = useSystemAccessibility()
  const variables = modulaWebCssVariables(tokens, {reduceTransparency})
  const layer = useModulaOverlayLayer('popover')
  const selected = options.find(option => option.value === value) ?? null
  return (
    <Combobox.Root
      disabled={disabled}
      itemToStringLabel={item => item.label}
      itemToStringValue={item => item.value}
      items={options}
      onValueChange={item => onChange(item?.value)}
      value={selected}>
      <label className="modula-web-combobox-label" htmlFor={id}>{label}</label>
      <Combobox.InputGroup className="modula-web-ui modula-web-combobox-group" style={variables}>
        <Combobox.Input className="modula-web-input" data-testid={testID} id={id} placeholder={placeholder} />
        <div className="modula-web-combobox-actions">
          <Combobox.Clear aria-label="Clear selection" className="modula-web-combobox-action">×</Combobox.Clear>
          <Combobox.Trigger aria-label="Open choices" className="modula-web-combobox-action">⌄</Combobox.Trigger>
        </div>
      </Combobox.InputGroup>
      <Combobox.Portal>
        <Combobox.Positioner className="modula-web-menu-positioner" sideOffset={4} style={{zIndex: layer.content}}>
          <Combobox.Popup className="modula-web-ui modula-web-menu-popup modula-web-combobox-popup" style={{...variables, zIndex: layer.content}}>
            <KonstaPopoverSurface>
              <ModulaOverlayLayerScope layer={layer.content}>
                <Combobox.Empty className="modula-web-select-empty">{noResultsLabel}</Combobox.Empty>
                <Combobox.List className="modula-web-select-list">
                  {option => (
                    <Combobox.Item className="modula-web-menu-item" key={option.value} value={option}>
                      <Combobox.ItemIndicator className="modula-web-menu-indicator">✓</Combobox.ItemIndicator>
                      <span className="modula-web-menu-label">{option.label}</span>
                      {option.description ? <span className="modula-web-menu-trailing">{option.description}</span> : null}
                    </Combobox.Item>
                  )}
                </Combobox.List>
              </ModulaOverlayLayerScope>
            </KonstaPopoverSurface>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  )
}
