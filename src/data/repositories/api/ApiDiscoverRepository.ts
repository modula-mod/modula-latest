import {decodeDiscoverResult} from '@/api/decoding'
import type {ApiClient} from '@/api/client'
import type {DiscoverRepository} from '@/data/repositories/contracts'

export class ApiDiscoverRepository implements DiscoverRepository {
  constructor(private readonly client: ApiClient) {}

  getDiscover() {
    return this.client.get({path: '/v1/discover'}, decodeDiscoverResult)
  }
}
