import {createContext} from 'react'

import type {RegisterAccountInput, SignInCredentials, VerifyEmailInput} from '@/auth/contracts'

export type SessionActions = {
  signIn(credentials: SignInCredentials, returnTo?: string): Promise<void>
  register(input: RegisterAccountInput, returnTo?: string): Promise<void>
  verifyEmail(input: VerifyEmailInput): Promise<void>
  resendVerification(email: string): Promise<void>
  continueAsGuest(): void
  continueAsDemo(email: 'andrei@modula.local' | 'gaia@modula.local'): Promise<void>
  signOut(): Promise<void>
}

export const SessionActionsContext = createContext<SessionActions | null>(null)
