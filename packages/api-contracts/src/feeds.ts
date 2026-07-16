import type {CursorPage} from './pagination.js'
import type {SocialPostDto} from './posts.js'

export type HomeFeedPage = CursorPage<SocialPostDto>
