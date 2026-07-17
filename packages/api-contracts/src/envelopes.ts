import type {ApiErrorBody} from './errors.js'

export type ApiMeta = {
  requestId: string
  serverTime: string
}

export type ApiSuccessEnvelope<T> = {
  ok: true
  data: T
  meta: ApiMeta
}

export type ApiFailureEnvelope = {
  ok: false
  error: ApiErrorBody
  meta: ApiMeta
}

export type ApiEnvelope<T> = ApiSuccessEnvelope<T> | ApiFailureEnvelope
