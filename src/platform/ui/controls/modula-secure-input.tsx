import type {ComponentProps} from 'react'

import {ModulaTextInput} from '@/platform/ui/controls/modula-text-input'

type SecureProps = Omit<ComponentProps<typeof ModulaTextInput>, 'secureTextEntry'>

/** Password / secret field — Expo UI SecureField on native via TextInput adapter. */
export function ModulaSecureInput(props: SecureProps) {
  return (
    <ModulaTextInput
      {...props}
      secureTextEntry
      autoCorrect={props.autoCorrect ?? false}
      autoCapitalize={props.autoCapitalize ?? 'none'}
    />
  )
}
