import type {
  AccessToken,
  AuthResult,
  AuthenticatedSession,
  ChangePasswordInput,
  ForgotPasswordInput,
  RefreshToken,
  RegisterAccountInput,
  RegisterPendingResult,
  ResetPasswordInput,
  SignInCredentials,
  VerifyEmailInput,
} from '@/auth/contracts'
import type {GreenfieldAccount} from '@modula/greenfield-contracts'
import type {GreenfieldSession} from '@modula/greenfield-contracts'

export type HandleAvailability = {
  handle: string
  available: boolean
  reason?: string
}

export type RepositoryExportJob = {
  exportId: string
  status: 'queued' | 'running' | 'completed' | 'failed'
  createdAt: string
  downloadUrl?: string
  integrityNote?: string
}

export interface AuthRepository {
  signIn(credentials: SignInCredentials): Promise<AuthResult>
  register(input: RegisterAccountInput): Promise<RegisterPendingResult | AuthResult>
  verifyEmail(input: VerifyEmailInput): Promise<AuthResult>
  resendVerification(email: string): Promise<{resent: boolean}>
  refresh(refreshToken: RefreshToken): Promise<AuthResult>
  getSession(accessToken: AccessToken): Promise<AuthenticatedSession>
  getMe(): Promise<GreenfieldAccount & {email?: string}>
  changeHandle(handle: string): Promise<{handle: string; accountId: string}>
  checkHandleAvailability(handle: string): Promise<HandleAvailability>
  listSessions(): Promise<GreenfieldSession[]>
  revokeSession(sessionId: string): Promise<void>
  revokeOtherSessions(): Promise<void>
  changePassword(input: ChangePasswordInput): Promise<void>
  forgotPassword(input: ForgotPasswordInput): Promise<{accepted: boolean}>
  resetPassword(input: ResetPasswordInput): Promise<{reset: boolean}>
  createRepositoryExport(): Promise<RepositoryExportJob>
  getRepositoryExport(exportId: string): Promise<RepositoryExportJob>
  signOut(refreshToken: RefreshToken | null): Promise<void>
}
