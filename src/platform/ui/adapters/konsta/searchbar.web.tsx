import {Searchbar} from 'konsta/react'
import {useId, useImperativeHandle, useRef, type KeyboardEvent, type Ref} from 'react'
import type {TextInput as RNTextInput} from 'react-native'

export function KonstaSearchbar({
  accessibilityLabel,
  autoCapitalize,
  autoCorrect,
  autoFocus,
  forwardedRef,
  onCancel,
  onChangeText,
  onEscape,
  onSubmitEditing,
  placeholder,
  testID,
  value,
}: {
  accessibilityLabel: string
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters'
  autoCorrect?: boolean
  autoFocus?: boolean
  forwardedRef: Ref<RNTextInput>
  onCancel?: () => void
  onChangeText: (value: string) => void
  onEscape?: () => void
  onSubmitEditing?: () => void
  placeholder: string
  testID?: string
  value: string
}) {
  const generatedId = useId()
  const inputId = testID ? `${testID}-input` : `modula-search-${generatedId}`
  const inputRef = useRef<HTMLInputElement | null>(null)
  useImperativeHandle(forwardedRef, () => inputRef.current as unknown as RNTextInput)

  const captureInput = (host: HTMLElement | null) => {
    const input = host?.querySelector('input') ?? null
    inputRef.current = input
    if (!input) return
    input.setAttribute('aria-label', accessibilityLabel)
    input.setAttribute('role', 'searchbox')
    input.setAttribute('autocapitalize', autoCapitalize ?? 'none')
    input.setAttribute('autocomplete', 'off')
    input.setAttribute('spellcheck', autoCorrect ? 'true' : 'false')
    if (autoFocus) requestAnimationFrame(() => input.focus())
  }

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') onEscape?.()
    if (event.key === 'Enter') onSubmitEditing?.()
  }

  return (
    <Searchbar
      clearButton
      className="modula-konsta-searchbar"
      data-testid={testID}
      disableButton={Boolean(onCancel)}
      inputId={inputId}
      onClear={() => {
        onChangeText('')
        requestAnimationFrame(() => inputRef.current?.focus())
      }}
      onDisable={onCancel}
      onInput={event => onChangeText(event.currentTarget.value)}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      ref={captureInput}
      value={value}
    />
  )
}
