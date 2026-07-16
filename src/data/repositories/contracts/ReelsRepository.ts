import type {ReelItem} from '@/domain/discovery'

export interface ReelsRepository {
  getReels(): Promise<ReelItem[]>
}
