import {createContext} from 'react'

import type {
  EmailCodeRequestResult,
  EmailCodeSignInInput,
  RegisterAccountInput,
  SignInCredentials,
  VerifyEmailInput,
} from '@/auth/contracts'
import type {ModulaProfile} from '@/features/profile/contracts'

export type SessionActions = {
  signIn(credentials: SignInCredentials, returnTo?: string): Promise<void>
  requestEmailSignInCode(email: string): Promise<EmailCodeRequestResult>
  signInWithEmailCode(input: EmailCodeSignInInput, returnTo?: string): Promise<void>
  register(input: RegisterAccountInput, returnTo?: string): Promise<void>
  verifyEmail(input: VerifyEmailInput): Promise<void>
  resendVerification(email: string): Promise<void>
  continueAsGuest(): void
  continueAsDemo(
    email: 'andrei@modula.local' | 'gaia@modula.local',
    returnTo?: string,
  ): Promise<void>
  updateCurrentProfile(profile: ModulaProfile): void
  signOut(): Promise<void>
}

export const SessionActionsContext = createContext<SessionActions | null>(null)
