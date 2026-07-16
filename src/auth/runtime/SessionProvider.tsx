import {useCallback, useEffect, useMemo, useState, type PropsWithChildren} from 'react'
import {useRouter, type Href} from 'expo-router'
import {useQueryClient} from '@tanstack/react-query'

import type {AuthResult, RegisterAccountInput, SessionState, SignInCredentials} from '@/auth/contracts'
import {SessionActionsContext, type SessionActions} from '@/auth/runtime/SessionActionsContext'
import {SessionStateContext} from '@/auth/runtime/SessionStateContext'
import {SESSION_BOOTSTRAP_TIMEOUT_MS} from '@/auth/runtime/SessionBootstrap'
import {runtimeEnvironment} from '@/config/runtimeEnvironment'
import {sanitizeReturnTo} from '@/auth/navigation/safeReturnTo'
import {useAppServices} from '@/runtime/useAppServices'

const localPassword = 'modula-local-password'

export function SessionProvider({children}: PropsWithChildren) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const services = useAppServices()
  const [session, setSession] = useState<SessionState>({status: 'booting'})

  const acceptAuthResult = useCallback(
    async (result: AuthResult, returnTo = '/') => {
      services.accessTokenStore.set(result.tokens.accessToken)
      await services.sessionStorage.setRefreshToken(result.tokens.refreshToken)
      setSession(result.session)
      await queryClient.cancelQueries()
      await queryClient.invalidateQueries()
      router.replace(sanitizeReturnTo(returnTo) as Href)
    },
    [queryClient, router, services],
  )

  const signIn = useCallback(
    async (credentials: SignInCredentials, returnTo = '/') => {
      const email = credentials.email.trim().toLowerCase()
      const result = await services.authRepository.signIn({...credentials, email})
      await acceptAuthResult(result, returnTo)
    },
    [acceptAuthResult, services.authRepository],
  )

  const register = useCallback(
    async (input: RegisterAccountInput, returnTo = '/') => {
      const result = await services.authRepository.register({
        ...input,
        email: input.email.trim().toLowerCase(),
        handle: input.handle.trim().toLowerCase(),
      })
      await acceptAuthResult(result, returnTo)
    },
    [acceptAuthResult, services.authRepository],
  )

  const continueAsGuest = useCallback(() => {
    services.accessTokenStore.clear()
    void services.sessionStorage.clearRefreshToken().catch(() => undefined)
    setSession({status: 'guest'})
    router.replace('/' as Href)
  }, [router, services])

  const continueAsDemo = useCallback(
    async (email: 'andrei@modula.local' | 'gaia@modula.local') => {
      const result = await services.authRepository.signIn({
        email,
        password: localPassword,
      })
      await acceptAuthResult(result, '/')
    },
    [acceptAuthResult, services.authRepository],
  )

  const signOut = useCallback(async () => {
    const refreshToken = await services.sessionStorage.getRefreshToken().catch(() => null)
    await services.authRepository.signOut(refreshToken).catch(() => undefined)
    await services.sessionStorage.clearRefreshToken().catch(() => undefined)
    services.accessTokenStore.clear()
    await queryClient.cancelQueries()
    queryClient.clear()
    setSession({status: 'signedOut'})
    router.replace('/welcome' as Href)
  }, [queryClient, router, services])

  useEffect(() => {
    services.refreshCoordinator.onFailed(() => {
      services.accessTokenStore.clear()
      queryClient.clear()
      setSession({status: 'signedOut', error: 'Session expired.'})
      router.replace('/welcome' as Href)
    })
  }, [queryClient, router, services])

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
          router.replace('/welcome' as Href)
          return
        }
        const stored = await services.sessionStorage.getRefreshToken().catch(() => null)
        if (stored) {
          const refreshed = await services.authRepository.refresh(stored)
          services.accessTokenStore.set(refreshed.tokens.accessToken)
          await services.sessionStorage.setRefreshToken(refreshed.tokens.refreshToken)
          if (active) setSession(refreshed.session)
          return
        }
        if (runtimeEnvironment.demoSession === 'owner' && runtimeEnvironment.appEnvironment !== 'production') {
          const result = await services.authRepository.signIn({
            email: 'andrei@modula.local',
            password: localPassword,
          })
          services.accessTokenStore.set(result.tokens.accessToken)
          await services.sessionStorage.setRefreshToken(result.tokens.refreshToken)
          if (active) setSession(result.session)
          return
        }
        if (active) setSession({status: 'signedOut'})
      } catch {
        services.accessTokenStore.clear()
        await services.sessionStorage.clearRefreshToken().catch(() => undefined)
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
  }, [router, services])

  const actions = useMemo<SessionActions>(
    () => ({
      signIn,
      register,
      continueAsGuest,
      continueAsDemo,
      signOut,
    }),
    [continueAsDemo, continueAsGuest, register, signIn, signOut],
  )

  return (
    <SessionStateContext.Provider value={session}>
      <SessionActionsContext.Provider value={actions}>
        {children}
      </SessionActionsContext.Provider>
    </SessionStateContext.Provider>
  )
}
