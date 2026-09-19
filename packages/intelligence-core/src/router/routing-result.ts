import type {IntelligenceErrorCode} from '../contracts/errors.js'
import type {IntelligenceProvider} from '../contracts/provider.js'

export type IntelligenceRoutingResult =
  | {
      ok: true
      provider: IntelligenceProvider
      reason: string
    }
  | {
      ok: false
      code: IntelligenceErrorCode
      reason: string
    }
