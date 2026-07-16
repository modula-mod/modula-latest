import type {DiscoverResult} from '@/domain/discovery'

export interface DiscoverRepository {
  getDiscover(): Promise<DiscoverResult>
}
