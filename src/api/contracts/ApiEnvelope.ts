import type {ApiErrorCode} from '@/api/contracts/ApiError'

export type ApiSuccessEnvelope<T> = {
  ok: true
  data: T
  meta: {
    requestId: string
    serverTime: string
  }
}

export type ApiFailureEnvelope = {
  ok: false
  error: {
    code: ApiErrorCode
    message: string
    fieldErrors?: Record<string, string>
    retryable: boolean
  }
  meta: {
    requestId: string
    serverTime: string
  }
}

export type ApiEnvelope<T> = ApiSuccessEnvelope<T> | ApiFailureEnvelope
