import type {ApiClient} from '@/api/client'
import type {LocalApiController} from '@/api/local'
import type {AccessTokenStore} from '@/auth/runtime/AccessTokenStore'
import type {SessionRefreshCoordinator} from '@/auth/runtime/SessionRefreshCoordinator'
import type {SessionStorage} from '@/auth/storage'
import type {
  ActivityRepository,
  AppearanceRepository,
  AtprotoRepository,
  AuthRepository,
  DiscoverRepository,
  ExtensionRepository,
  FeedRepository,
  MetadataRepository,
  ModuleRepository,
  PostRepository,
  ProductPreferencesRepository,
  ProfileRepository,
  ReelsRepository,
  ModerationRepository,
  SocialGraphRepository,
  StoriesRepository,
  ToolsRepository,
} from '@/data/repositories/contracts'
import type {ModulaIntelligence} from '@/runtime/createModulaAi'

export type AppServices = {
  apiClient: ApiClient
  authRepository: AuthRepository
  feedRepository: FeedRepository
  postRepository: PostRepository
  productPreferencesRepository: ProductPreferencesRepository
  profileRepository: ProfileRepository
  socialGraphRepository: SocialGraphRepository
  moderationRepository: ModerationRepository
  storiesRepository: StoriesRepository
  activityRepository: ActivityRepository
  appearanceRepository: AppearanceRepository
  discoverRepository: DiscoverRepository
  reelsRepository: ReelsRepository
  metadataRepository: MetadataRepository
  moduleRepository: ModuleRepository
  atprotoRepository: AtprotoRepository
  extensionRepository: ExtensionRepository
  toolsRepository: ToolsRepository
  localApiController: LocalApiController | null
  accessTokenStore: AccessTokenStore
  sessionStorage: SessionStorage
  refreshCoordinator: SessionRefreshCoordinator
  /** Shared intelligence-core facade (Greenfield semantics; not native on-device runtime). */
  ai: ModulaIntelligence
}
