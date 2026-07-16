import {
  confirmModulaAction,
  type ConfirmModulaActionOptions,
} from '@/platform/ui/menus/confirmModulaAction'

export type ModulaConfirmationDialogOptions = ConfirmModulaActionOptions

/**
 * Confirmation dialog adapter. Routes through the shared confirm helper so
 * Expo UI ConfirmationDialog can replace the body later without API churn.
 */
export function presentModulaConfirmationDialog(
  options: ModulaConfirmationDialogOptions,
): Promise<boolean> {
  return confirmModulaAction(options)
}

export function ModulaConfirmationDialog() {
  // Declarative host reserved for Expo UI ConfirmationDialog wiring.
  // Product code should call `presentModulaConfirmationDialog` for now.
  return null
}
