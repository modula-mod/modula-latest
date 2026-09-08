import type {PresentModulaActionsOptions} from '@/platform/ui/menus/types'

type WebActionPresenter = (
  options: PresentModulaActionsOptions,
) => Promise<string | null>

let presenter: WebActionPresenter | null = null

export function registerWebActionPresenter(next: WebActionPresenter): () => void {
  presenter = next
  return () => {
    if (presenter === next) presenter = null
  }
}

export function requestWebAction(
  options: PresentModulaActionsOptions,
): Promise<string | null> {
  return presenter ? presenter(options) : Promise.resolve(null)
}
