import {useFocusEffect} from 'expo-router'
import {useCallback} from 'react'
import {useQueryClient, type QueryKey} from '@tanstack/react-query'

export function useRefreshOnFocus(queryKey: QueryKey) {
  const queryClient = useQueryClient()
  useFocusEffect(
    useCallback(() => {
      void queryClient.refetchQueries({
        queryKey,
        type: 'active',
        stale: true,
      })
    }, [queryClient, queryKey]),
  )
}
