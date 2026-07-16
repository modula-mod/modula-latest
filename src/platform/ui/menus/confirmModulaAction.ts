import {Alert} from 'react-native'

export type ConfirmModulaActionOptions = {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
}

/**
 * Native confirmation dialog for discard / destructive previews.
 * Thin adapter — Phase 4.5 may route through ModulaConfirmationDialog + @expo/ui.
 */
export function confirmModulaAction(
  options: ConfirmModulaActionOptions,
): Promise<boolean> {
  return new Promise(resolve => {
    Alert.alert(options.title, options.message, [
      {
        text: options.cancelLabel ?? 'Keep editing',
        style: 'cancel',
        onPress: () => resolve(false),
      },
      {
        text: options.confirmLabel ?? 'Discard',
        style: options.destructive === false ? 'default' : 'destructive',
        onPress: () => resolve(true),
      },
    ])
  })
}
