export type WebConfirmationOptions = {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
}

type WebConfirmationPresenter = (
  options: WebConfirmationOptions,
) => Promise<boolean>

let presenter: WebConfirmationPresenter | null = null

export function registerWebConfirmationPresenter(
  next: WebConfirmationPresenter,
): () => void {
  presenter = next
  return () => {
    if (presenter === next) presenter = null
  }
}

export function requestWebConfirmation(
  options: WebConfirmationOptions,
): Promise<boolean> {
  if (presenter) return presenter(options)
  if (typeof window !== 'undefined') {
    return Promise.resolve(window.confirm(`${options.title}\n\n${options.message}`))
  }
  return Promise.resolve(false)
}
