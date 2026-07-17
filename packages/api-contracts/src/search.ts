import type {ModulaProfileDto} from './profiles.js'
import type {SocialPostDto} from './posts.js'

export type SearchType = 'all' | 'profiles' | 'posts' | 'modules'
export type SearchScope = SearchType

export type SearchResultDto = {
  query?: string
  profiles: ModulaProfileDto[]
  posts: SocialPostDto[]
  modules: Array<{id: string; name: string; description?: string}>
}
