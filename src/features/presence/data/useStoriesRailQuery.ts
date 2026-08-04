import {useQuery} from '@tanstack/react-query'

import {useSession} from '@/auth/runtime'
import {queryKeys, queryNetworkMode} from '@/data/query'
import type {PresenceRailPerson} from '@/features/presence/contracts/presenceRail'
import type {StoryRailEntry} from '@/domain/stories'
import {useAppServices} from '@/runtime'

function toRailPerson(entry: StoryRailEntry): PresenceRailPerson {
  return {
    id: entry.isOwner ? 'you' : entry.ownerProfileId,
    name: entry.isOwner ? 'You' : entry.displayName,
    uri: entry.avatarUrl ?? undefined,
    fresh: entry.ringState === 'unviewed' || entry.ringState === 'partial',
    groupId: entry.groupId,
    ringState: entry.ringState,
    isOwner: entry.isOwner,
    itemCount: entry.itemCount,
  }
}

export function useStoriesRailQuery() {
  const {storiesRepository} = useAppServices()
  const session = useSession()
  const accountId =
    session.status === 'signedIn' ? session.account.id : 'signedOut'

  return useQuery({
    queryKey: queryKeys.stories.rail(accountId),
    networkMode: queryNetworkMode(),
    enabled: session.status === 'signedIn',
    queryFn: async () => {
      const entries = await storiesRepository.getRail()
      return entries.map(toRailPerson)
    },
  })
}
