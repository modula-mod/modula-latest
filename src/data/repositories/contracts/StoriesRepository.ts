import type {CreateStoryInput, StoryGroup, StoryRailEntry} from '@/domain/stories'

export interface StoriesRepository {
  getRail(): Promise<StoryRailEntry[]>
  getGroup(groupId: string): Promise<StoryGroup>
  create(input: CreateStoryInput): Promise<StoryGroup>
  markViewed(itemId: string): Promise<void>
  deleteItem(itemId: string): Promise<void>
}
