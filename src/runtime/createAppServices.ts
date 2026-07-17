import {ApiClient} from '@/api/client'
import {HttpApiTransport, LocalApiTransport, type ApiTransport} from '@/api/transport'
import {LocalApiDatabase, LocalApiServer, MutableLocalApiConfiguration, seedLocalApiDatabase, type LocalApiController} from '@/api/local'
import {runtimeEnvironment} from '@/config/runtimeEnvironment'
import {AccessTokenStore} from '@/auth/runtime/AccessTokenStore'
import {SessionRefreshCoordinator} from '@/auth/runtime/SessionRefreshCoordinator'
import {createSessionStorage} from '@/auth/storage'
import {
  ApiActivityRepository,
  ApiAtprotoRepository,
  ApiAuthRepository,
  ApiDiscoverRepository,
  ApiFeedRepository,
  ApiMetadataRepository,
  ApiPostRepository,
  ApiProfileRepository,
  ApiReelsRepository,
  ApiSocialGraphRepository,
} from '@/data/repositories/api'
import type {AppServices} from '@/runtime/AppServices'

export function createAppServices(): AppServices {
  const accessTokenStore = new AccessTokenStore()
  const configuration = new MutableLocalApiConfiguration()
  let secureStoreFailure = false
  let localApiController: LocalApiController | null = null
  let transport: ApiTransport

  if (runtimeEnvironment.dataSource === 'local') {
    const database = new LocalApiDatabase(seedLocalApiDatabase())
    const server = new LocalApiServer(database, configuration)
    transport = new LocalApiTransport(server)
    localApiController = {
      getConfiguration: () => configuration.get(),
      setLatencyMode: mode => configuration.update({latencyMode: mode}),
      setFailureMode: mode => configuration.update({failureMode: mode}),
      setForcedStatus: status => configuration.update({forcedStatus: status}),
      setSessionExpiryEnabled: enabled => configuration.update({sessionExpiryEnabled: enabled}),
      resetLocalData: () => {
        database.reset(seedLocalApiDatabase())
        server.resetRouter()
      },
      expireAccessToken: () => database.expireAccessToken(),
      invalidateRefreshToken: () => database.invalidateRefreshToken(),
      simulateSecureStoreFailure: enabled => {
        secureStoreFailure = enabled
      },
      isSecureStoreFailureSimulated: () => secureStoreFailure,
    }
  } else {
    if (!runtimeEnvironment.apiUrl) {
      throw new Error('Remote API URL is required for remote data source.')
    }
    transport = new HttpApiTransport(runtimeEnvironment.apiUrl)
  }

  let refreshCoordinator: SessionRefreshCoordinator
  const client = new ApiClient({
    transport,
    getAccessToken: () => accessTokenStore.get(),
    onSessionExpired: () => refreshCoordinator.refresh(),
  })
  const authRepository = new ApiAuthRepository(client)
  const sessionStorage = createSessionStorage({
    shouldFail: () => secureStoreFailure,
  })
  refreshCoordinator = new SessionRefreshCoordinator(
    authRepository,
    sessionStorage,
    accessTokenStore,
  )

  return {
    authRepository,
    feedRepository: new ApiFeedRepository(client),
    postRepository: new ApiPostRepository(client),
    profileRepository: new ApiProfileRepository(client),
    socialGraphRepository: new ApiSocialGraphRepository(client),
    activityRepository: new ApiActivityRepository(client),
    discoverRepository: new ApiDiscoverRepository(client),
    reelsRepository: new ApiReelsRepository(client),
    metadataRepository: new ApiMetadataRepository(client),
    atprotoRepository: new ApiAtprotoRepository(client),
    localApiController,
    accessTokenStore,
    sessionStorage,
    refreshCoordinator,
  }
}
