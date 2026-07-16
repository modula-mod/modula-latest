import type {LocalApiController} from '@/api/local'
import type {AccessTokenStore} from '@/auth/runtime/AccessTokenStore'
import type {SessionRefreshCoordinator} from '@/auth/runtime/SessionRefreshCoordinator'
import type {SessionStorage} from '@/auth/storage'
import type {
  ActivityRepository,
  AuthRepository,
  DiscoverRepository,
  FeedRepository,
  PostRepository,
  ProfileRepository,
  ReelsRepository,
  SocialGraphRepository,
} from '@/data/repositories/contracts'

export type AppServices = {
  authRepository: AuthRepository
  feedRepository: FeedRepository
  postRepository: PostRepository
  profileRepository: ProfileRepository
  socialGraphRepository: SocialGraphRepository
  activityRepository: ActivityRepository
  discoverRepository: DiscoverRepository
  reelsRepository: ReelsRepository
  localApiController: LocalApiController | null
  accessTokenStore: AccessTokenStore
  sessionStorage: SessionStorage
  refreshCoordinator: SessionRefreshCoordinator
}
