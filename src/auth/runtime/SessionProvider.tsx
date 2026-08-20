import {useCallback, useEffect, useMemo, useState, type PropsWithChildren} from 'react'
import {useRouter, type Href} from 'expo-router'
import {useQueryClient} from '@tanstack/react-query'

import {parseSessionId} from '@/api/contracts/identifiers'
import type {
  AuthResult,
  EmailCodeSignInInput,
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

/** Prevent React Strict Mode double-mount from racing two refresh calls and wiping the vault. */
let bootstrapInFlight: Promise<SessionState> | null = null

function isPendingResult(value: RegisterPendingResult | AuthResult): value is RegisterPendingResult {
  return 'kind' in value && value.kind === 'pendingVerification'
}

function isLikelyTransientAuthError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const code =
    'code' in error && typeof (error as {code: unknown}).code === 'string'
      ? (error as {code: string}).code
      : ''
  const message = error instanceof Error ? error.message.toLowerCase() : ''
  return (
    code === 'NETWORK' ||
    code === 'TIMEOUT' ||
    code === 'UNAVAILABLE' ||
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('failed to fetch') ||
    message.includes('network request failed')
  )
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
        refreshTokenExpiresAt: result.tokens.refreshTokenExpiresAt,
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

  const requestEmailSignInCode = useCallback(
    async (email: string) =>
      services.authRepository.requestEmailSignInCode(email.trim().toLowerCase()),
    [services.authRepository],
  )

  const signInWithEmailCode = useCallback(
    async (input: EmailCodeSignInInput, returnTo = '/') => {
      const result = await services.authRepository.signInWithEmailCode({
        ...input,
        email: input.email.trim().toLowerCase(),
      })
      await acceptAuthResult(result, returnTo)
    },
    [acceptAuthResult, services.authRepository],
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
          verificationChallengeId: result.verificationChallengeId,
          verificationExpiresAt: result.verificationExpiresAt,
          verificationDelivery: result.verificationDelivery,
        })
        const verifyParam = result.verificationToken
          ? `t=${encodeURIComponent(result.verificationToken)}`
          : `c=${encodeURIComponent(result.verificationChallengeId ?? '')}&email=${encodeURIComponent(result.email)}`
        router.replace(`/verify-email?${verifyParam}` as Href)
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
    async (
      email: 'andrei@modula.local' | 'gaia@modula.local',
      returnTo = '/',
    ) => {
      if (runtimeEnvironment.appEnvironment === 'production') {
        throw new Error('Demo accounts are unavailable in production.')
      }
      try {
        const result = await services.authRepository.signIn({
          email,
          password: localPassword,
        })
        await acceptAuthResult(result, returnTo)
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

  const updateCurrentProfile = useCallback<SessionActions['updateCurrentProfile']>(profile => {
    setSession(current => {
      if (current.status !== 'signedIn' && current.status !== 'refreshing') return current
      return {
        ...current,
        account: {
          ...current.account,
          displayName: profile.displayName,
          primaryHandle: profile.handle,
        },
        greenfieldAccount: {
          ...current.greenfieldAccount,
          primaryHandle: profile.handle,
        },
        profile,
      }
    })
  }, [])

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
      // Only leave booting if bootstrap is still unresolved — never wipe storage on timeout.
      if (!active) return
      setSession(current =>
        current.status === 'booting'
          ? {status: 'signedOut', error: 'Session bootstrap timed out.'}
          : current,
      )
    }, SESSION_BOOTSTRAP_TIMEOUT_MS)

    async function resolveBootstrapState(): Promise<SessionState> {
      // `guest` forces a guest shell for demos. `signedOut` / empty only means
      // "do not auto-login the local demo owner" — never skip SecureStore restore.
      if (runtimeEnvironment.demoSession === 'guest') {
        return {status: 'guest'}
      }

      const bundle = await services.sessionStorage.getSessionBundle().catch(() => null)
      if (__DEV__) {
        const hasRefresh = Boolean(bundle?.refreshToken)
        console.info(
          `Session bootstrap: bundle=${bundle ? 'present' : 'missing'} refresh=${hasRefresh ? 'yes' : 'no'}`,
        )
      }

      if (bundle?.refreshToken) {
        const refreshed = await services.refreshCoordinator.refreshSession()
        if (refreshed) {
          services.accessTokenStore.set(refreshed.tokens.accessToken)
          await services.sessionStorage.setSessionBundle({
            accessToken: refreshed.tokens.accessToken,
            refreshToken: refreshed.tokens.refreshToken,
            sessionId: refreshed.session.sessionId,
            accessTokenExpiresAt: refreshed.tokens.accessTokenExpiresAt,
            refreshTokenExpiresAt: refreshed.tokens.refreshTokenExpiresAt,
          })
          if (__DEV__) console.info('Session bootstrap: refresh restored')
          return refreshed.session
        }

        const latest = await services.sessionStorage.getSessionBundle().catch(() => null)
        const accessToken = latest?.accessToken || bundle.accessToken
        if (accessToken) {
          try {
            services.accessTokenStore.set(accessToken)
            const session = await services.authRepository.getSession(accessToken)
            if (__DEV__) console.info('Session bootstrap: access-token fallback restored')
            return {
              ...session,
              sessionId: parseSessionId(
                (latest?.sessionId || bundle.sessionId).length > 0
                  ? latest?.sessionId || bundle.sessionId
                  : session.sessionId,
              ),
              accessTokenExpiresAt:
                latest?.accessTokenExpiresAt ||
                bundle.accessTokenExpiresAt ||
                session.accessTokenExpiresAt,
            }
          } catch (accessError) {
            if (__DEV__) {
              console.info(
                'Session bootstrap: refresh+access fallback failed',
                accessError instanceof Error ? accessError.message : 'unknown',
              )
            }
            if (isLikelyTransientAuthError(accessError)) {
              return {
                status: 'signedOut',
                error: 'Could not restore session (network). Try again.',
              }
            }
          }
        }

        const still = await services.sessionStorage.getSessionBundle().catch(() => null)
        if (still?.refreshToken && still.refreshToken === bundle.refreshToken) {
          await clearLocalSession()
          return {status: 'signedOut', error: SESSION_REVOKED_MESSAGE}
        }
        const raced = await services.refreshCoordinator.refreshSession()
        if (raced) {
          services.accessTokenStore.set(raced.tokens.accessToken)
          if (__DEV__) console.info('Session bootstrap: refresh restored after race')
          return raced.session
        }
        return {status: 'signedOut', error: SESSION_REVOKED_MESSAGE}
      }

      if (
        runtimeEnvironment.demoSession === 'owner' &&
        runtimeEnvironment.appEnvironment !== 'production'
      ) {
        const result = await services.authRepository.signIn({
          email: 'andrei@modula.local',
          password: localPassword,
        })
        services.accessTokenStore.set(result.tokens.accessToken)
        await services.sessionStorage.setSessionBundle({
          accessToken: result.tokens.accessToken,
          refreshToken: result.tokens.refreshToken,
          sessionId: result.session.sessionId,
          accessTokenExpiresAt: result.tokens.accessTokenExpiresAt,
          refreshTokenExpiresAt: result.tokens.refreshTokenExpiresAt,
        })
        return result.session
      }
      return {status: 'signedOut'}
    }

    async function bootstrap() {
      try {
        if (!bootstrapInFlight) {
          bootstrapInFlight = resolveBootstrapState().finally(() => {
            bootstrapInFlight = null
          })
        }
        const next = await bootstrapInFlight
        if (!active) return
        setSession(next)
        if (next.status === 'signedOut' && next.error === SESSION_REVOKED_MESSAGE) {
          router.replace('/sign-in' as Href)
        }
      } catch {
        services.accessTokenStore.clear()
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
  }, [clearLocalSession, router, services])

  const actions = useMemo<SessionActions>(
    () => ({
      signIn,
      requestEmailSignInCode,
      signInWithEmailCode,
      register,
      verifyEmail,
      resendVerification,
      continueAsGuest,
      continueAsDemo,
      updateCurrentProfile,
      signOut,
    }),
    [
      continueAsDemo,
      continueAsGuest,
      register,
      resendVerification,
      signIn,
      requestEmailSignInCode,
      signInWithEmailCode,
      signOut,
      updateCurrentProfile,
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
