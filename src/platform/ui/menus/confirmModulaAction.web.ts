import {
  requestWebConfirmation,
  type WebConfirmationOptions,
} from '@/platform/ui/menus/confirmation-presenter.web'

export type ConfirmModulaActionOptions = WebConfirmationOptions

/** Routes imperative confirmations through the mounted Modula web dialog host. */
export function confirmModulaAction(
  options: ConfirmModulaActionOptions,
): Promise<boolean> {
  return requestWebConfirmation(options)
}
