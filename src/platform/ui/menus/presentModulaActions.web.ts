import {requestWebAction} from '@/platform/ui/menus/action-presenter.web'
import type {PresentModulaActionsOptions} from '@/platform/ui/menus/types'

/** Routes legacy imperative calls into the shared responsive Modula presenter. */
export function presentModulaActions(
  options: PresentModulaActionsOptions,
): Promise<string | null> {
  return requestWebAction(options)
}
