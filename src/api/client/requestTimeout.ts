import {ModulaApiError} from '@/api/contracts/ApiError'

export const DEFAULT_REQUEST_TIMEOUT_MS = 15_000

export function createTimeoutSignal(
  signal: AbortSignal | undefined,
  timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
): {signal: AbortSignal; cleanup: () => void} {
  const controller = new AbortController()
  let settled = false
  const timeout = setTimeout(() => {
    settled = true
    controller.abort(
      new ModulaApiError({
        message: 'Request timed out.',
        code: 'TIMEOUT',
        status: 0,
        retryable: true,
      }),
    )
  }, timeoutMs)

  const abortFromParent = () => {
    if (!settled) {
      controller.abort(signal?.reason)
    }
  }

  if (signal?.aborted) abortFromParent()
  signal?.addEventListener('abort', abortFromParent)

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timeout)
      signal?.removeEventListener('abort', abortFromParent)
    },
  }
}
