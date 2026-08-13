import {useEffect} from 'react'
import {useInfiniteQuery, useMutation, useQuery, useQueryClient} from '@tanstack/react-query'
import type {GreenfieldSearchEntityType} from '@modula/api-contracts'

import {useSession} from '@/auth/runtime'
import {queryKeys, queryNetworkMode} from '@/data/query'
import {useAppServices} from '@/runtime'

export type UniversalSearchScope = 'all' | 'profiles' | 'posts' | 'modules'

const ENTITY_TYPES_BY_SCOPE: Record<UniversalSearchScope, GreenfieldSearchEntityType[]> = {
  all: ['profile', 'post', 'module', 'module-release'],
  profiles: ['profile'],
  posts: ['post'],
  modules: ['module', 'module-release'],
}

export function entityTypesForSearchScope(scope: UniversalSearchScope): GreenfieldSearchEntityType[] {
  return ENTITY_TYPES_BY_SCOPE[scope]
}

export function useUniversalSearchQuery(input: {
  query: string
  scope: UniversalSearchScope
  limit?: number
}) {
  const {discoverRepository} = useAppServices()
  const session = useSession()
  const queryClient = useQueryClient()
  const q = input.query.trim()
  const scope = input.scope
  const limit = input.limit ?? 6
  const accountId =
    session.status === 'signedIn'
      ? session.account.id
      : session.status === 'guest'
        ? 'guest'
        : 'signedOut'
  const search = useInfiniteQuery({
    queryKey: queryKeys.search.results(q, scope, limit),
    networkMode: queryNetworkMode(),
    enabled: session.status === 'signedIn' && q.length > 0,
    initialPageParam: null as string | null,
    queryFn: ({pageParam, signal}) =>
      discoverRepository.universalSearch(
        {
          query: q,
          entityTypes: entityTypesForSearchScope(scope),
          cursor: pageParam,
          limit,
        },
        signal,
      ),
    getNextPageParam: lastPage => lastPage.nextCursor,
  })

  useEffect(() => {
    if (!search.dataUpdatedAt || session.status !== 'signedIn') return
    void queryClient.invalidateQueries({queryKey: queryKeys.search.recent(accountId)})
  }, [accountId, queryClient, search.dataUpdatedAt, session.status])

  return search
}

export function useRecentSearchesQuery() {
  const {discoverRepository} = useAppServices()
  const session = useSession()
  const accountId =
    session.status === 'signedIn'
      ? session.account.id
      : session.status === 'guest'
        ? 'guest'
        : 'signedOut'
  return useQuery({
    queryKey: queryKeys.search.recent(accountId),
    networkMode: queryNetworkMode(),
    enabled: session.status === 'signedIn',
    queryFn: () => discoverRepository.listRecentSearches(8),
  })
}

export function useSavedSearchesQuery() {
  const {discoverRepository} = useAppServices()
  const session = useSession()
  const accountId =
    session.status === 'signedIn'
      ? session.account.id
      : session.status === 'guest'
        ? 'guest'
        : 'signedOut'
  return useQuery({
    queryKey: queryKeys.search.saved(accountId),
    networkMode: queryNetworkMode(),
    enabled: session.status === 'signedIn',
    queryFn: () => discoverRepository.listSavedSearches(),
  })
}

export function useSearchPersistenceMutations() {
  const {discoverRepository} = useAppServices()
  const queryClient = useQueryClient()
  const session = useSession()
  const accountId =
    session.status === 'signedIn'
      ? session.account.id
      : session.status === 'guest'
        ? 'guest'
        : 'signedOut'
  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({queryKey: queryKeys.search.recent(accountId)}),
      queryClient.invalidateQueries({queryKey: queryKeys.search.saved(accountId)}),
    ])
  }

  return {
    save: useMutation({
      mutationFn: (input: {name: string; query: string; scope: UniversalSearchScope}) =>
        discoverRepository.saveSearch({
          name: input.name,
          query: input.query,
          entityTypes: entityTypesForSearchScope(input.scope),
          limit: 6,
        }),
      onSuccess: invalidate,
    }),
    deleteSaved: useMutation({
      mutationFn: (savedSearchId: string) => discoverRepository.deleteSavedSearch(savedSearchId),
      onSuccess: invalidate,
    }),
    deleteRecent: useMutation({
      mutationFn: (recentSearchId: string) => discoverRepository.deleteRecentSearch(recentSearchId),
      onSuccess: invalidate,
    }),
  }
}
