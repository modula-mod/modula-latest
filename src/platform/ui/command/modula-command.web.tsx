import {Dialog} from '@base-ui/react/dialog'
import {useMemo, useRef, useState, type KeyboardEvent} from 'react'

import {ModulaIcon} from '@/platform/ui/icons'
import type {ModulaCommandProps} from '@/platform/ui/command/modula-command.types'
import {useSystemAccessibility} from '@/theme/accessibility/useSystemAccessibility'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'
import {modulaWebCssVariables} from '@/platform/web-ui/theme'

export type {ModulaCommandAction, ModulaCommandProps} from '@/platform/ui/command/modula-command.types'

export function ModulaCommand({
  isOpen,
  ...props
}: ModulaCommandProps) {
  if (!isOpen) return null
  return <OpenModulaCommand {...props} />
}

function OpenModulaCommand({
  onOpenChange,
  actions,
  title = 'Commands',
  description = 'Search available actions',
  placeholder = 'Search commands',
  emptyLabel = 'No matching commands.',
  testID,
}: Omit<ModulaCommandProps, 'isOpen'>) {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const tokens = useThemeTokens()
  const {reduceTransparency} = useSystemAccessibility()
  const variables = modulaWebCssVariables(tokens, {reduceTransparency})
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const available = actions.filter(action => !action.disabled)
    if (!needle) return available
    return available.filter(action => [action.label, action.description, ...(action.keywords ?? [])]
      .filter(Boolean).join(' ').toLowerCase().includes(needle))
  }, [actions, query])

  const resolvedActiveIndex = Math.min(activeIndex, Math.max(0, visible.length - 1))

  const select = (index: number) => {
    const action = visible[index]
    if (!action) return
    action.onSelect()
    onOpenChange(false)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex(index => visible.length ? (index + 1) % visible.length : 0)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex(index => visible.length ? (index - 1 + visible.length) % visible.length : 0)
    } else if (event.key === 'Home') {
      event.preventDefault()
      setActiveIndex(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      setActiveIndex(Math.max(0, visible.length - 1))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      select(resolvedActiveIndex)
    }
  }

  return (
    <Dialog.Root open onOpenChange={open => onOpenChange(open)} modal>
      <Dialog.Portal>
        <Dialog.Backdrop className="modula-web-ui modula-web-backdrop" style={variables} />
        <Dialog.Viewport className="modula-web-ui modula-web-dialog-viewport" style={variables}>
          <Dialog.Popup
            className="modula-web-dialog-popup modula-web-command"
            data-size="regular"
            data-testid={testID}
            finalFocus
            initialFocus={inputRef}
            style={variables}>
            <Dialog.Title className="modula-web-overlay-title">{title}</Dialog.Title>
            <Dialog.Description className="modula-web-visually-hidden">{description}</Dialog.Description>
            <input
              aria-activedescendant={visible[resolvedActiveIndex] ? `modula-command-${visible[resolvedActiveIndex].id}` : undefined}
              aria-controls="modula-command-results"
              aria-expanded="true"
              aria-label={placeholder}
              autoComplete="off"
              className="modula-web-command-input"
              onChange={event => { setQuery(event.currentTarget.value); setActiveIndex(0) }}
              onKeyDown={onKeyDown}
              placeholder={placeholder}
              ref={inputRef}
              role="combobox"
              value={query}
            />
            <div className="modula-web-command-results" id="modula-command-results" role="listbox">
              {visible.length ? visible.map((action, index) => (
                <button
                  aria-selected={index === resolvedActiveIndex}
                  className="modula-web-command-item"
                  id={`modula-command-${action.id}`}
                  key={action.id}
                  onClick={() => select(index)}
                  onMouseEnter={() => setActiveIndex(index)}
                  role="option"
                  type="button">
                  {action.icon ? <ModulaIcon name={action.icon} size={18} colour={tokens.colours.textSecondary} /> : null}
                  <span className="modula-web-command-copy">
                    <span>{action.label}</span>
                    {action.description ? <span>{action.description}</span> : null}
                  </span>
                </button>
              )) : <div className="modula-web-select-empty">{emptyLabel}</div>}
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
