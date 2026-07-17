import {decodeApiMetadata} from '@/api/decoding/decodeMetadata'
import type {ApiClient} from '@/api/client'
import type {MetadataRepository} from '@/data/repositories/contracts/MetadataRepository'

export class ApiMetadataRepository implements MetadataRepository {
  constructor(private readonly client: ApiClient) {}

  getMetadata() {
    return this.client.get({path: '/v1/meta'}, decodeApiMetadata)
  }
}
