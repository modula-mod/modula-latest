import {useEffect, useMemo, useState} from 'react'
import {View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {useSession} from '@/auth/runtime'
import {AppIcon, type AppIconName} from '@/components/primitives/AppIcon'
import {useDiscoverQuery} from '@/features/discover/data'
import {getProfileRouteForIdentity} from '@/features/profile/navigation/openProfile'
import {selectionHaptic} from '@/lib/haptics'
import {ModulaSearchField} from '@/platform/ui/controls/modula-search-field'
import {ModulaListAvatar, ModulaListRow, ModulaListSection} from '@/platform/ui/lists'
import {ModulaSheet} from '@/platform/ui/sheets/modula-sheet'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type HomeSearchModalProps = {
  visible: boolean
  onClose: () => void
}

type SearchAction = {
  id: string
  label: string
  icon: AppIconName
  href: Href
}

type AccessRole = 'Owner' | 'Can edit' | 'Can view'

const ACTIONS: readonly SearchAction[] = [
  {id: 'discover', label: 'Open Discover', icon: 'discover', href: '/discover'},
  {id: 'compose', label: 'Compose post', icon: 'create', href: '/compose'},
  {id: 'people', label: 'Find people', icon: 'people', href: '/discover'},
  {id: 'communities', label: 'Communities', icon: 'community', href: '/discover'},
  {id: 'saved', label: 'Saved posts', icon: 'saved', href: '/saved'},
  {id: 'presence', label: 'Live Presence', icon: 'play', href: '/discover/live'},
]

/** Home search composed entirely from the shared search, sheet and list system. */
export function HomeSearchModal({visible, onClose}: HomeSearchModalProps) {
  const router = useRouter()
  const session = useSession()
  const ownerProfileId = session.status === 'signedIn' ? session.profile.id : null
  const {colours, spacing} = useThemeTokens()
  const discoverQuery = useDiscoverQuery()
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (visible) return undefined
    const id = setTimeout(() => setQuery(''), 0)
    return () => clearTimeout(id)
  }, [visible])

  const people = useMemo(() => {
    const profiles = discoverQuery.data?.suggestedProfiles ?? []
    const roles: AccessRole[] = ['Owner', 'Can edit', 'Can view', 'Can edit', 'Can view']
    const filtered = query.trim()
      ? profiles.filter(profile =>
          (profile.displayName ?? profile.handle ?? '')
            .toLowerCase()
            .includes(query.trim().toLowerCase()),
        )
      : profiles
    return filtered.slice(0, 6).map((profile, index) => ({
      profile,
      role: roles[index % roles.length] ?? 'Can view',
    }))
  }, [discoverQuery.data?.suggestedProfiles, query])

  const actions = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? ACTIONS.filter(action => action.label.toLowerCase().includes(q)) : ACTIONS
  }, [query])

  const go = (href: Href) => {
    void selectionHaptic()
    onClose()
    router.push(href)
  }

  return (
    <ModulaSheet
      accessibilityLabel="Search Modula"
      detents={['large', 'full']}
      isPresented={visible}
      material="glass"
      onDismiss={onClose}
      presentation="interactive"
      testID="home-search-sheet"
      title="Search">
      <View style={{gap: spacing[4]}}>
        <ModulaSearchField
          accessibilityLabel="Search Modula"
          autoFocus
          onChangeText={setQuery}
          onEscape={onClose}
          placeholder="Search Modula"
          testID="home-search-input"
          value={query}
          variant="screen"
        />

        <ModulaListSection title="Actions">
          {actions.map((action, index) => (
            <ModulaListRow
              key={action.id}
              accessory="chevron"
              last={index === actions.length - 1}
              leading={<AppIcon name={action.icon} colour={colours.textSecondary} size={20} />}
              onPress={() => go(action.href)}
              title={action.label}
              variant="navigation"
            />
          ))}
          {actions.length === 0 ? (
            <ModulaListRow last title="No matching actions" />
          ) : null}
        </ModulaListSection>

        <ModulaListSection title="People with access">
          {people.map(({profile, role}, index) => (
            <ModulaListRow
              key={profile.id}
              last={index === people.length - 1}
              leading={
                <ModulaListAvatar
                  colour={profile.coverColour}
                  name={profile.displayName ?? profile.handle ?? 'Person'}
                  size={36}
                  uri={profile.avatarUri}
                />
              }
              metadata={role}
              onPress={() =>
                go(getProfileRouteForIdentity(profile, ownerProfileId ?? '') as Href)
              }
              title={profile.displayName ?? profile.handle}
              variant="person"
            />
          ))}
          {people.length === 0 ? <ModulaListRow last title="No people to show yet" /> : null}
        </ModulaListSection>
      </View>
    </ModulaSheet>
  )
}
