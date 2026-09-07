import {Select} from '@base-ui/react/select'
import {useState} from 'react'

import {ModulaDrawer} from '@/platform/ui/drawers/modula-drawer'
import {useResponsivePresentation} from '@/platform/ui/responsive'
import {useSystemAccessibility} from '@/theme/accessibility/useSystemAccessibility'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'
import {modulaWebCssVariables} from '@/platform/web-ui/theme'

export type ModulaSelectOption = {value: string; label: string}
export type ModulaSelectFieldProps = {
  value?: string
  options: ModulaSelectOption[]
  onChange: (value: string | undefined) => void
  placeholder?: string
  accessibilityLabel: string
  sheetTitle?: string
  loading?: boolean
  allowClear?: boolean
}

const EMPTY_VALUE = '__modula_empty_value__'

/** Native DOM-backed, keyboard-complete select popup for desktop web. */
export function ModulaSelectField({
  value,
  options,
  onChange,
  placeholder = 'Choose',
  accessibilityLabel,
  sheetTitle,
  loading = false,
  allowClear = true,
}: ModulaSelectFieldProps) {
  const presentation = useResponsivePresentation('picker', {anchored: true})
  return presentation === 'drawer' ? (
    <TouchSelectField {...{value, options, onChange, placeholder, accessibilityLabel, sheetTitle, loading, allowClear}} />
  ) : (
    <DesktopSelectField {...{value, options, onChange, placeholder, accessibilityLabel, loading, allowClear}} />
  )
}

function TouchSelectField({
  value,
  options,
  onChange,
  placeholder = 'Choose',
  accessibilityLabel,
  sheetTitle,
  loading = false,
  allowClear = true,
}: ModulaSelectFieldProps) {
  const tokens = useThemeTokens()
  const {reduceTransparency} = useSystemAccessibility()
  const variables = modulaWebCssVariables(tokens, {reduceTransparency})
  const [open, setOpen] = useState(false)
  const selected = options.find(option => option.value === value)
  const shown = loading ? 'Loading…' : selected?.label ?? (value || placeholder)
  const choose = (next: string | undefined) => { onChange(next); setOpen(false) }
  return (
    <>
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`${accessibilityLabel}, ${shown}`}
        className="modula-web-ui modula-web-select-trigger"
        disabled={loading}
        onClick={() => setOpen(true)}
        style={variables}
        type="button">
        <span>{shown}</span>
        <span aria-hidden="true">›</span>
      </button>
      <ModulaDrawer
        isPresented={open}
        onDismiss={() => setOpen(false)}
        presentation="picker"
        title={sheetTitle ?? accessibilityLabel}>
        <div className="modula-web-touch-actions" role="radiogroup" aria-label={accessibilityLabel}>
          {allowClear ? (
            <TouchSelectOption checked={!value} label="None" onSelect={() => choose(undefined)} />
          ) : null}
          {options.map(option => (
            <TouchSelectOption
              checked={option.value === value}
              key={option.value}
              label={option.label}
              onSelect={() => choose(option.value)}
            />
          ))}
          {!loading && !options.length ? <div className="modula-web-select-empty">No choices available.</div> : null}
        </div>
      </ModulaDrawer>
    </>
  )
}

function TouchSelectOption({checked, label, onSelect}: {checked: boolean; label: string; onSelect: () => void}) {
  return (
    <button aria-checked={checked} className="modula-web-menu-item" onClick={onSelect} role="radio" type="button">
      <span className="modula-web-menu-indicator">{checked ? '✓' : ''}</span>
      <span className="modula-web-menu-label">{label}</span>
    </button>
  )
}

function DesktopSelectField({
  value,
  options,
  onChange,
  placeholder = 'Choose',
  accessibilityLabel,
  loading = false,
  allowClear = true,
}: Omit<ModulaSelectFieldProps, 'sheetTitle'>) {
  const tokens = useThemeTokens()
  const {reduceTransparency} = useSystemAccessibility()
  const variables = modulaWebCssVariables(tokens, {reduceTransparency})
  const items = allowClear ? [{value: EMPTY_VALUE, label: 'None'}, ...options] : options
  return (
    <Select.Root
      disabled={loading}
      items={items}
      onValueChange={next => onChange(next === EMPTY_VALUE || next == null ? undefined : String(next))}
      value={value ?? (allowClear ? EMPTY_VALUE : null)}>
      <Select.Label className="modula-web-visually-hidden">{accessibilityLabel}</Select.Label>
      <Select.Trigger
        aria-label={accessibilityLabel}
        className="modula-web-ui modula-web-select-trigger"
        style={variables}>
        <Select.Value placeholder={loading ? 'Loading…' : placeholder} />
        <Select.Icon aria-hidden="true">⌄</Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner className="modula-web-menu-positioner" sideOffset={4}>
          <Select.Popup className="modula-web-ui modula-web-menu-popup" style={variables}>
            <Select.List className="modula-web-select-list">
              {items.map(option => (
                <Select.Item className="modula-web-menu-item" key={option.value} value={option.value}>
                  <Select.ItemIndicator className="modula-web-menu-indicator">✓</Select.ItemIndicator>
                  <Select.ItemText className="modula-web-menu-label">{option.label}</Select.ItemText>
                </Select.Item>
              ))}
              {!loading && !items.length ? <div className="modula-web-select-empty">No choices available.</div> : null}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  )
}
