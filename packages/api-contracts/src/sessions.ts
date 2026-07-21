import type {BackendCapability} from './capabilities.js'

export type ModulaSessionStatus = 'active' | 'expired' | 'revoked' | 'suspended'

export type ModulaSession = {
  id: string
  actorId: string
  status: ModulaSessionStatus
  createdAt: string
  expiresAt: string
  lastSeenAt: string
  revokedAt: string | null
  capabilities: BackendCapability[]
}

export type PreviewSessionRequest = {
  handle: string
}

export type PreviewSessionResponse = {
  accessToken: string
  session: ModulaSession
}

export type CreatePreviewSessionInput = PreviewSessionRequest
export type CreatePreviewSessionResult = {
  token: string
  session: ModulaSession
}
