import type {ApiRequest, ApiTransportResponse} from '@/api/contracts'
import type {LocalApiServer} from '@/api/local/LocalApiServer'
import type {ApiTransport} from '@/api/transport/ApiTransport'

export class LocalApiTransport implements ApiTransport {
  constructor(private readonly server: LocalApiServer) {}

  send(request: ApiRequest): Promise<ApiTransportResponse> {
    return this.server.handle(request)
  }
}
