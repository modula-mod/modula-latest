import type {ApiRequest, ApiTransportResponse} from '@/api/contracts/ApiRequest'

export interface ApiTransport {
  send(request: ApiRequest): Promise<ApiTransportResponse>
}
