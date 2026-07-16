import {ApiClient} from '@/api/client/ApiClient'
import type {ApiTransport} from '@/api/transport'
import type {AccessToken} from '@/auth/contracts'

export function createApiClient(input: {
  transport: ApiTransport
  getAccessToken?: () => AccessToken | null
  onSessionExpired?: () => Promise<AccessToken | null>
}): ApiClient {
  return new ApiClient(input)
}
