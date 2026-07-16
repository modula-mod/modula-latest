export type LocalLatencyMode = 'instant' | 'normal' | 'slow'
export type LocalFailureMode =
  | 'none'
  | 'nextRequest'
  | 'allRequests'
  | 'authentication'
  | 'feed'
  | 'mutations'

export type LocalApiConfiguration = {
  latencyMode: LocalLatencyMode
  failureMode: LocalFailureMode
  forcedStatus: number | null
  sessionExpiryEnabled: boolean
}

export const defaultLocalApiConfiguration: LocalApiConfiguration = {
  latencyMode: 'normal',
  failureMode: 'none',
  forcedStatus: null,
  sessionExpiryEnabled: true,
}

export type LocalApiController = {
  getConfiguration(): LocalApiConfiguration
  setLatencyMode(mode: LocalLatencyMode): void
  setFailureMode(mode: LocalFailureMode): void
  setForcedStatus(status: number | null): void
  setSessionExpiryEnabled(enabled: boolean): void
  resetLocalData(): void
  expireAccessToken(): void
  invalidateRefreshToken(): void
  simulateSecureStoreFailure(enabled: boolean): void
  isSecureStoreFailureSimulated(): boolean
}

export class MutableLocalApiConfiguration {
  private value = {...defaultLocalApiConfiguration}

  get(): LocalApiConfiguration {
    return {...this.value}
  }

  update(next: Partial<LocalApiConfiguration>) {
    this.value = {...this.value, ...next}
  }
}
