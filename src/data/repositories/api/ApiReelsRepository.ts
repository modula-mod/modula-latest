import {decodeReels} from '@/api/decoding'
import type {ApiClient} from '@/api/client'
import type {ReelsRepository} from '@/data/repositories/contracts'

export class ApiReelsRepository implements ReelsRepository {
  constructor(private readonly client: ApiClient) {}

  getReels() {
    return this.client.get({path: '/v1/reels'}, decodeReels)
  }
}
