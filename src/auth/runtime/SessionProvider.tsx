import {useCallback, useEffect, useMemo, useState, type PropsWithChildren} from 'react'
import {useRouter, type Href} from 'expo-router'
import {useQueryClient} from '@tanstack/react-query'

import type {
  AuthResult,
  RegisterAccountInput,
  RegisterPendingResult,
  SessionState,
  SignInCredentials,
  VerifyEmailInput,
} from '@/auth/contracts'
import {SessionActionsContext, type SessionActions} from '@/auth/runtime/SessionActionsContext'
import {SessionStateContext} from '@/auth/runtime/SessionStateContext'
import {SESSION_BOOTSTRAP_TIMEOUT_MS} from '@/auth/runtime/SessionBootstrap'
import {runtimeEnvironment} from '@/config/runtimeEnvironment'
import {sanitizeReturnTo} from '@/auth/navigation/safeReturnTo'
import {useAppServices} from '@/runtime/useAppServices'

const localPassword = 'modula-local-password'
const SESSION_REVOKED_MESSAGE =
  'Your session was revoked for security. Sign in again to continue.'

function isPendingResult(value: RegisterPendingResult | AuthResult): value is RegisterPendingResult {
  return 'kind' in value && value.kind === 'pendingVerification'
}

export function SessionProvider({children}: PropsWithChildren) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const services = useAppServices()
  const [session, setSession] = useState<SessionState>({status: 'booting'})

  const persistAuthResult = useCallback(
    async (result: AuthResult) => {
      services.accessTokenStore.set(result.tokens.accessToken)
      await services.sessionStorage.setSessionBundle({
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
        sessionId: result.session.sessionId,
        accessTokenExpiresAt: result.tokens.accessTokenExpiresAt,
      })
      setSession(result.session)
    },
    [services],
  )

  const acceptAuthResult = useCallback(
    async (result: AuthResult, returnTo = '/') => {
      await persistAuthResult(result)
      await queryClient.cancelQueries()
      await queryClient.invalidateQueries()
      router.replace(sanitizeReturnTo(returnTo) as Href)
    },
    [persistAuthResult, queryClient, router],
  )

  const clearLocalSession = useCallback(async () => {
    await services.sessionStorage.clearSessionBundle().catch(() => undefined)
    services.accessTokenStore.clear()
    await queryClient.cancelQueries()
    queryClient.clear()
  }, [queryClient, services])

  const signIn = useCallback(
    async (credentials: SignInCredentials, returnTo = '/') => {
      const email = credentials.email.trim().toLowerCase()
      try {
        const result = await services.authRepository.signIn({...credentials, email})
        await acceptAuthResult(result, returnTo)
      } catch (error) {
        const code =
          error && typeof error === 'object' && 'code' in error
            ? String((error as {code: string}).code)
            : undefined
        if (code === 'pendingVerification' || code === 'FORBIDDEN') {
          setSession({status: 'pendingVerification', email})
          router.replace('/verify-email' as Href)
          return
        }
        if (code === 'suspended') {
          setSession({status: 'suspended'})
          return
        }
        throw error
      }
    },
    [acceptAuthResult, router, services.authRepository],
  )

  const register = useCallback(
    async (input: RegisterAccountInput, _returnTo = '/') => {
      const email = input.email.trim().toLowerCase()
      const result = await services.authRepository.register({
        ...input,
        email,
        handle: input.handle.trim().toLowerCase(),
      })
      if (isPendingResult(result)) {
        setSession({
          status: 'pendingVerification',
          email: result.email,
          accountId: result.accountId,
          primaryHandle: result.primaryHandle,
          verificationToken: result.verificationToken,
        })
        router.replace(
          `/verify-email?email=${encodeURIComponent(result.email)}&token=${encodeURIComponent(result.verificationToken ?? '')}` as Href,
        )
        return
      }
      await acceptAuthResult(result, '/')
    },
    [acceptAuthResult, router, services.authRepository],
  )

  const verifyEmail = useCallback(
    async (input: VerifyEmailInput) => {
      const result = await services.authRepository.verifyEmail(input)
      if (
        'kind' in result &&
        (result as {kind?: string}).kind === 'verifiedSignInRequired'
      ) {
        setSession({status: 'signedOut'})
        router.replace(
          `/sign-in?email=${encodeURIComponent(input.email ?? '')}&verified=1` as Href,
        )
        return
      }
      await acceptAuthResult(result as AuthResult, '/')
    },
    [acceptAuthResult, router, services.authRepository],
  )

  const resendVerification = useCallback(
    async (email: string) => {
      await services.authRepository.resendVerification(email)
    },
    [services.authRepository],
  )

  const continueAsGuest = useCallback(() => {
    services.accessTokenStore.clear()
    void services.sessionStorage.clearSessionBundle().catch(() => undefined)
    setSession({status: 'guest'})
    router.replace('/' as Href)
  }, [router, services])

  const continueAsDemo = useCallback(
    async (email: 'andrei@modula.local' | 'gaia@modula.local') => {
      if (runtimeEnvironment.appEnvironment === 'production') {
        throw new Error('Demo accounts are unavailable in production.')
      }
      try {
        const result = await services.authRepository.signIn({
          email,
          password: localPassword,
        })
        await acceptAuthResult(result, '/')
      } catch (error) {
        const code =
          error && typeof error === 'object' && 'code' in error
            ? String((error as {code: string}).code)
            : undefined
        // Remote Greenfield rejects local-only demo passwords with UNAUTHENTICATED.
        // Surface a clear handled error instead of an uncaught ModulaApiError.
        if (code === 'UNAUTHENTICATED') {
          throw new Error(
            'Development demo accounts work only against the local API. Sign in with a Greenfield account, or use EXPO_PUBLIC_DATA_SOURCE=local.',
          )
        }
        throw error
      }
    },
    [acceptAuthResult, services.authRepository],
  )

  const signOut = useCallback(async () => {
    const refreshToken = await services.sessionStorage.getRefreshToken().catch(() => null)
    await services.authRepository.signOut(refreshToken).catch(() => undefined)
    await clearLocalSession()
    setSession({status: 'signedOut'})
    router.replace('/welcome' as Href)
  }, [clearLocalSession, router, services])

  useEffect(() => {
    services.refreshCoordinator.onFailed(() => {
      void clearLocalSession().then(() => {
        setSession({status: 'signedOut', error: SESSION_REVOKED_MESSAGE})
        router.replace('/sign-in' as Href)
      })
    })
  }, [clearLocalSession, router, services])

  useEffect(() => {
    let active = true
    const timeout = setTimeout(() => {
      if (active) setSession({status: 'signedOut', error: 'Session bootstrap timed out.'})
    }, SESSION_BOOTSTRAP_TIMEOUT_MS)

    async function bootstrap() {
      try {
        if (runtimeEnvironment.demoSession === 'guest') {
          if (active) setSession({status: 'guest'})
          return
        }
        if (runtimeEnvironment.demoSession === 'signedOut') {
          if (active) setSession({status: 'signedOut'})
          return
        }
        const bundle = await services.sessionStorage.getSessionBundle().catch(() => null)
        if (bundle?.refreshToken) {
          try {
            const refreshed = await services.authRepository.refresh(bundle.refreshToken)
            await persistAuthResult(refreshed)
            return
          } catch {
            await clearLocalSession()
            if (active) {
              setSession({status: 'signedOut', error: SESSION_REVOKED_MESSAGE})
              router.replace('/sign-in' as Href)
            }
            return
          }
        }
        // Demo-owner bootstrap is development-only and opt-in via EXPO_PUBLIC_DEMO_SESSION=owner.
        if (
          runtimeEnvironment.demoSession === 'owner' &&
          runtimeEnvironment.appEnvironment !== 'production'
        ) {
          const result = await services.authRepository.signIn({
            email: 'andrei@modula.local',
            password: localPassword,
          })
          await persistAuthResult(result)
          return
        }
        if (active) setSession({status: 'signedOut'})
      } catch {
        services.accessTokenStore.clear()
        await services.sessionStorage.clearSessionBundle().catch(() => undefined)
        if (active) setSession({status: 'signedOut', error: 'Session storage unavailable.'})
      } finally {
        clearTimeout(timeout)
      }
    }

    void bootstrap()
    return () => {
      active = false
      clearTimeout(timeout)
    }
  }, [clearLocalSession, persistAuthResult, router, services])

  const actions = useMemo<SessionActions>(
    () => ({
      signIn,
      register,
      verifyEmail,
      resendVerification,
      continueAsGuest,
      continueAsDemo,
      signOut,
    }),
    [
      continueAsDemo,
      continueAsGuest,
      register,
      resendVerification,
      signIn,
      signOut,
      verifyEmail,
    ],
  )

  return (
    <SessionStateContext.Provider value={session}>
      <SessionActionsContext.Provider value={actions}>
        {children}
      </SessionActionsContext.Provider>
    </SessionStateContext.Provider>
  )
}
