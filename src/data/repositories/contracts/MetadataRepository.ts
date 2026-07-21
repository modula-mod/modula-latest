import type {ApiMetadata} from '@modula/api-contracts'

export interface MetadataRepository {
  getMetadata(): Promise<ApiMetadata>
}
