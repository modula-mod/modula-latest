export type SignInCredentials = {
  email: string
  password: string
}

export type RegisterAccountInput = {
  displayName: string
  email: string
  handle: string
  password: string
  inviteCode?: string
  acceptedTerms?: boolean
}

export type RegisterPendingResult = {
  kind: 'pendingVerification'
  email: string
  accountId: string
  primaryHandle: string
  verificationToken?: string
}

export type VerifyEmailInput = {
  token: string
  email?: string
}

export type ChangePasswordInput = {
  currentPassword: string
  newPassword: string
}

export type ForgotPasswordInput = {
  email: string
}

export type ResetPasswordInput = {
  token: string
  newPassword: string
}
