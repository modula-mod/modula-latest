import {useCallback, useEffect, useState} from 'react'
import {Pressable, StyleSheet} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {useSession} from '@/auth/runtime'
import {MaterialSurface} from '@/components/materials/MaterialSurface'
import {AppText} from '@/components/primitives/AppText'
import {
  SettingsLinkRow,
  SettingsMenuRow,
  SettingsOverflowMenu,
  SettingsScreen,
  SettingsSection,
  SettingsToggleRow,
} from '@/features/settings/components/SettingsRows'
import {canAccessDeveloperLabs} from '@/lib/platform'
import {useAppServices} from '@/runtime'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'
import type {
  NotificationPreferences,
  UpdateNotificationPreferencesInput,
} from '@/data/repositories/contracts'

const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  followEnabled: true,
  likeEnabled: true,
  reactionEnabled: true,
  repostEnabled: true,
  quoteEnabled: true,
  replyEnabled: true,
  commentEnabled: true,
  mentionEnabled: true,
  moduleEventEnabled: false,
  extensionEnabled: false,
  bundleStyle: 'focus',
  version: 1,
  updatedAt: '1970-01-01T00:00:00.000Z',
}

export function PrivacySafetyScreen() {
  const router = useRouter()
  const [privateAccount, setPrivateAccount] = useState(false)
  const [sensitiveMedia, setSensitiveMedia] = useState(true)

  return (
    <SettingsScreen
      title="Privacy"
      caption="Audience controls. Mute/block accounts from post overflow. Mute words and blocked lists are unavailable until Greenfield exposes them."
      right={
        <SettingsOverflowMenu
          title="Privacy"
          actions={[
            {id: 'mute', label: 'Mute words status'},
            {id: 'blocked', label: 'Blocked accounts status'},
          ]}
          onAction={id => {
            if (id === 'mute') router.push('/settings/mute-words' as Href)
            if (id === 'blocked') router.push('/settings/blocked' as Href)
          }}
        />
      }>
      <SettingsSection title="Audience">
        <SettingsToggleRow
          label="Private account"
          description="Future followers-only visibility."
          value={privateAccount}
          onValueChange={setPrivateAccount}
          preview
        />
        <SettingsToggleRow
          label="Warn on sensitive media"
          description="Local preference Preview."
          value={sensitiveMedia}
          onValueChange={setSensitiveMedia}
          last
          preview
        />
      </SettingsSection>
      <SettingsSection title="Safety">
        <SettingsLinkRow
          row={{
            title: 'Mute words',
            description: 'Unavailable — no mute-words API.',
            icon: 'text',
            route: '/settings/mute-words',
          }}
        />
        <SettingsLinkRow
          row={{
            title: 'Blocked accounts',
            description: 'Block from posts; list API not shipped.',
            icon: 'privacy',
            route: '/settings/blocked',
          }}
        />
        <SettingsLinkRow
          row={{
            title: 'Inner circle',
            description: 'Close friends style audience.',
            icon: 'community',
            route: '/settings/inner-circle',
            preview: true,
          }}
          last
        />
      </SettingsSection>
    </SettingsScreen>
  )
}

export function NotificationsSettingsScreen() {
  const router = useRouter()
  const session = useSession()
  const {activityRepository} = useAppServices()
  const [remotePreferences, setRemotePreferences] = useState<NotificationPreferences>(
    DEFAULT_NOTIFICATION_PREFERENCES,
  )
  const [localPreferences, setLocalPreferences] = useState<NotificationPreferences>(
    DEFAULT_NOTIFICATION_PREFERENCES,
  )
  const [status, setStatus] = useState<'loading' | 'ready' | 'saving' | 'local' | 'error'>(
    'loading',
  )
  const [error, setError] = useState<string | null>(null)
  const {colours, radius, spacing} = useThemeTokens()
  const accountId = session.status === 'signedIn' ? session.account.id : null
  const preferences = accountId ? remotePreferences : localPreferences
  const displayStatus = accountId ? status : 'local'
  const displayError = accountId ? error : null

  const bundleLabel =
    preferences.bundleStyle === 'individual'
      ? 'Individual'
      : preferences.bundleStyle === 'digest'
        ? 'Digest'
        : 'Focus-aware'

  useEffect(() => {
    let mounted = true
    if (!accountId) {
      return () => {
        mounted = false
      }
    }
    const loadPreferences = async () => {
      setStatus('loading')
      setError(null)
      try {
        const next = await activityRepository.getNotificationPreferences()
        if (!mounted) return
        setRemotePreferences(next)
        setStatus('ready')
      } catch {
        if (!mounted) return
        setStatus('error')
        setError('Notification preferences could not be loaded. Local defaults are shown.')
      }
    }
    void loadPreferences()
    return () => {
      mounted = false
    }
  }, [accountId, activityRepository])

  const updatePreference = useCallback(
    (patch: UpdateNotificationPreferencesInput) => {
      if (session.status !== 'signedIn') {
        setLocalPreferences(current => ({
          ...current,
          ...patch,
          updatedAt: new Date().toISOString(),
        }))
        return
      }
      const previous = preferences
      setRemotePreferences(current => ({
        ...current,
        ...patch,
        updatedAt: new Date().toISOString(),
      }))
      setStatus('saving')
      setError(null)
      void activityRepository
        .updateNotificationPreferences({
          ...patch,
          expectedVersion: previous.version,
        })
        .then(next => {
          setRemotePreferences(next)
          setStatus('ready')
        })
        .catch(() => {
          setRemotePreferences(previous)
          setStatus('error')
          setError('Notification preferences were not saved. Retry when the connection is stable.')
        })
    },
    [activityRepository, preferences, session.status],
  )

  return (
    <SettingsScreen
      title="Notifications"
      caption="Account-backed Activity preferences. Device push remains off until a future native permission flow is enabled."
      right={
        <SettingsOverflowMenu
          title="Notifications"
          actions={[
            {id: 'focus', label: 'Open Focus Mode'},
            {id: 'activity', label: 'Open Activity'},
          ]}
          onAction={id => {
            if (id === 'focus') router.push('/product/focus' as Href)
            if (id === 'activity') router.push('/activity' as Href)
          }}
        />
      }>
      <MaterialSurface
        role="card"
        style={[
          styles.banner,
          {
            backgroundColor: colours.accentSubtle,
            borderColor: colours.accentBorder,
            borderRadius: radius.large,
            gap: spacing[2],
            padding: spacing[4],
          },
        ]}>
        <AppText variant="label">Focus-aware bundling</AppText>
        <AppText variant="caption" colour="textSecondary">
          Light Focus groups low-priority notifications. Deep Focus can hold non-urgent
          activity until you return.
        </AppText>
      </MaterialSurface>

      {displayStatus === 'loading' || displayStatus === 'saving' || displayStatus === 'local' || displayError ? (
        <AppText
          variant="caption"
          colour={displayError ? 'destructive' : 'textTertiary'}
          style={{paddingHorizontal: spacing[4]}}>
          {displayError ??
            (displayStatus === 'loading'
              ? 'Loading saved notification preferences.'
              : displayStatus === 'saving'
                ? 'Saving notification preferences.'
                : 'Sign in to sync notification preferences across devices.')}
        </AppText>
      ) : null}

      <SettingsSection title="Delivery">
        <SettingsMenuRow
          label="Bundling style"
          description="How Activity groups alerts."
          value={bundleLabel}
          actions={[
            {id: 'individual', label: 'Individual'},
            {id: 'focus', label: 'Focus-aware'},
            {id: 'digest', label: 'Daily digest'},
          ]}
          onAction={id => {
            if (id === 'individual' || id === 'focus' || id === 'digest') {
              updatePreference({bundleStyle: id})
            }
          }}
        />
      </SettingsSection>

      <SettingsSection title="Activity">
        <SettingsToggleRow
          label="Likes"
          description="Show likes unless Focus Mode bundles them."
          value={preferences.likeEnabled && preferences.reactionEnabled}
          onValueChange={next => updatePreference({likeEnabled: next, reactionEnabled: next})}
        />
        <SettingsToggleRow
          label="Replies"
          description="Conversation updates when not held by Focus."
          value={preferences.replyEnabled && preferences.commentEnabled}
          onValueChange={next => updatePreference({replyEnabled: next, commentEnabled: next})}
        />
        <SettingsToggleRow
          label="Follows"
          description="New follows and relationship updates."
          value={preferences.followEnabled}
          onValueChange={next => updatePreference({followEnabled: next})}
        />
        <SettingsToggleRow
          label="Module updates"
          description="Module lifecycle and marketplace updates."
          value={preferences.moduleEventEnabled && preferences.extensionEnabled}
          onValueChange={next => updatePreference({moduleEventEnabled: next, extensionEnabled: next})}
          last
        />
      </SettingsSection>

      <SettingsSection title="Related">
        <SettingsLinkRow
          row={{
            title: 'Focus Mode',
            description: 'Choose when notifications bundle or wait.',
            icon: 'contrast',
            route: '/product/focus',
            preview: true,
          }}
        />
        <SettingsLinkRow
          row={{
            title: 'Glass Privacy',
            description: 'Message privacy levels for private context.',
            icon: 'privacy',
            route: '/product/glass-privacy',
            preview: true,
          }}
          last
        />
      </SettingsSection>
    </SettingsScreen>
  )
}

export function SecuritySettingsScreen() {
  const router = useRouter()
  return (
    <SettingsScreen
      title="Security"
      caption="Sessions, credentials, recovery methods, and account protection. Controls only appear when backed by Greenfield state."
      right={
        <SettingsOverflowMenu
          title="Security"
          actions={[
            {id: 'sessions', label: 'Active sessions'},
            {id: 'password', label: 'Password management'},
            {id: 'account', label: 'Account settings'},
          ]}
          onAction={id => {
            if (id === 'sessions') router.push('/settings/account/sessions' as Href)
            if (id === 'password') router.push('/settings/account/password' as Href)
            if (id === 'account') router.push('/settings/account' as Href)
          }}
        />
      }>
      <SettingsSection title="Sessions">
        <SettingsLinkRow
          row={{
            title: 'Active sessions',
            description: 'Current device and signed-in session list.',
            icon: 'security',
            route: '/settings/account/sessions',
          }}
        />
        <SettingsLinkRow
          row={{
            title: 'Sign out other sessions',
            description: 'Available from Active sessions.',
            icon: 'switch',
            route: '/settings/account/sessions',
          }}
          last
        />
      </SettingsSection>
      <SettingsSection title="Credentials">
        <SettingsLinkRow
          row={{
            title: 'Password',
            description: 'Change the password for this Modula Account.',
            icon: 'privacy',
            route: '/settings/account/password',
          }}
        />
        <SettingsLinkRow
          row={{
            title: 'Passkeys',
            description: 'Hardware passkey registration is not part of this beta.',
            icon: 'security',
            comingSoon: true,
          }}
        />
        <SettingsLinkRow
          row={{
            title: 'Authenticator app (TOTP)',
            description: 'Time-based one-time passwords are not part of this beta.',
            icon: 'security',
            comingSoon: true,
          }}
        />
        <SettingsLinkRow
          row={{
            title: 'Recovery codes',
            description: 'Recovery-code setup is not part of this beta.',
            icon: 'privacy',
            comingSoon: true,
          }}
        />
        <SettingsLinkRow
          row={{
            title: 'Recovery email',
            description: 'Sign-in email remains the recovery identity for this beta.',
            icon: 'account',
            route: '/settings/account/email',
          }}
          last
        />
      </SettingsSection>
      <SettingsSection title="Protection">
        <SettingsLinkRow
          row={{
            title: 'Recent security activity',
            description: 'Session events and account changes.',
            icon: 'activity',
            route: '/settings/account/sessions',
          }}
        />
        <SettingsLinkRow
          row={{
            title: 'Account deletion protection',
            description: 'Deletion remains guarded from Account settings.',
            icon: 'warning',
            route: '/settings/account',
          }}
          last
        />
      </SettingsSection>
    </SettingsScreen>
  )
}

export function ContentMediaScreen() {
  const [autoplay, setAutoplay] = useState(true)
  const [dataSaver, setDataSaver] = useState(false)
  const [quality, setQuality] = useState<'auto' | 'high' | 'data'>('auto')

  return (
    <SettingsScreen
      title="Content"
      caption="Playback and media preferences for the local shell.">
      <SettingsSection title="Playback">
        <SettingsToggleRow
          label="Autoplay media"
          description="Applies to Reels and media grids when available."
          value={autoplay}
          onValueChange={setAutoplay}
          preview
        />
        <SettingsToggleRow
          label="Data saver"
          description="Prefer lower-resolution previews."
          value={dataSaver}
          onValueChange={setDataSaver}
          preview
        />
        <SettingsMenuRow
          label="Preferred quality"
          description="Local Preview preference."
          value={quality === 'auto' ? 'Auto' : quality === 'high' ? 'High' : 'Data saver'}
          preview
          last
          actions={[
            {id: 'auto', label: 'Auto'},
            {id: 'high', label: 'High'},
            {id: 'data', label: 'Data saver'},
          ]}
          onAction={id => {
            if (id === 'auto' || id === 'high' || id === 'data') setQuality(id)
          }}
        />
      </SettingsSection>
      <SettingsSection title="Reactions">
        <SettingsLinkRow
          row={{
            title: 'Sticker picker',
            description: 'Restrained reaction Preview.',
            icon: 'gif',
            route: '/reactions',
            preview: true,
          }}
          last
        />
      </SettingsSection>
    </SettingsScreen>
  )
}

export function LanguageTranslateScreen() {
  const router = useRouter()
  const [preferOriginal, setPreferOriginal] = useState(true)
  const [target, setTarget] = useState('English')

  return (
    <SettingsScreen
      title="Language"
      caption="Ties to post Translate Preview. No remote translation API is called.">
      <SettingsSection title="Translate">
        <SettingsMenuRow
          label="Preferred language"
          description="Preview target language for Translate."
          value={target}
          preview
          actions={[
            {id: 'en', label: 'English'},
            {id: 'es', label: 'Spanish'},
            {id: 'fr', label: 'French'},
            {id: 'de', label: 'German'},
          ]}
          onAction={id => {
            const map: Record<string, string> = {
              en: 'English',
              es: 'Spanish',
              fr: 'French',
              de: 'German',
            }
            if (map[id]) setTarget(map[id])
          }}
        />
        <SettingsToggleRow
          label="Prefer original language"
          description="Show translate action without auto-replacing text."
          value={preferOriginal}
          onValueChange={setPreferOriginal}
          last
          preview
        />
      </SettingsSection>
      <SettingsSection title="Tools">
        <SettingsLinkRow
          row={{
            title: 'Translate Lite module',
            description: 'Open marketplace detail.',
            icon: 'text',
            route: '/marketplace/module-translate-lite',
            preview: true,
          }}
        />
        <SettingsLinkRow
          row={{
            title: 'Open Home feed',
            description: 'Try Translate on a post.',
            icon: 'home',
            onPress: () => router.push('/' as Href),
          }}
          last
        />
      </SettingsSection>
    </SettingsScreen>
  )
}

export function MarketplacePreferencesScreen() {
  const router = useRouter()
  const [featured, setFeatured] = useState(true)
  const [creators, setCreators] = useState(true)
  const [sort, setSort] = useState<'featured' | 'newest' | 'name'>('featured')

  return (
    <SettingsScreen
      title="Marketplace"
      caption="Local browse preferences for the seeded catalog. Install remains Preview."
      right={
        <SettingsOverflowMenu
          title="Marketplace"
          actions={[{id: 'open', label: 'Open Marketplace'}]}
          onAction={id => {
            if (id === 'open') router.push('/marketplace' as Href)
          }}
        />
      }>
      <SettingsSection title="Browse">
        <SettingsMenuRow
          label="Default sort"
          value={
            sort === 'featured' ? 'Featured' : sort === 'newest' ? 'Newest' : 'Name'
          }
          preview
          actions={[
            {id: 'featured', label: 'Featured'},
            {id: 'newest', label: 'Newest'},
            {id: 'name', label: 'Name'},
          ]}
          onAction={id => {
            if (id === 'featured' || id === 'newest' || id === 'name') setSort(id)
          }}
        />
        <SettingsToggleRow
          label="Show Featured first"
          value={featured}
          onValueChange={setFeatured}
          preview
        />
        <SettingsToggleRow
          label="Show creator cards"
          value={creators}
          onValueChange={setCreators}
          last
          preview
        />
      </SettingsSection>
      <SettingsSection>
        <SettingsLinkRow
          row={{
            title: 'Open Marketplace',
            description: 'Browse modules and tools.',
            icon: 'marketplace',
            onPress: () => router.push('/marketplace' as Href),
          }}
          last
        />
      </SettingsSection>
    </SettingsScreen>
  )
}

export function DataStorageScreen() {
  const router = useRouter()
  return (
    <SettingsScreen
      title="Data"
      caption="Local media, cache, and Saved content estimates for this device Preview."
      right={
        <SettingsOverflowMenu
          title="Data"
          actions={[
            {id: 'saved', label: 'Open Saved'},
            {id: 'export', label: 'Export account data'},
            {
              id: 'clear',
              label: 'Clear cache (Preview)',
              disabled: true,
              disabledReason: 'Not wired yet',
            },
          ]}
          onAction={id => {
            if (id === 'saved') router.push('/saved' as Href)
            if (id === 'export') router.push('/settings/account/export' as Href)
          }}
        />
      }>
      <SettingsSection title="Libraries">
        <SettingsLinkRow
          row={{
            title: 'Saved posts',
            description: 'Open Saved library.',
            icon: 'saved',
            route: '/saved',
          }}
        />
        <SettingsLinkRow
          row={{
            title: 'Collections',
            description: 'Saved collections Preview.',
            icon: 'bookmark',
            route: '/collections',
            preview: true,
          }}
        />
        <SettingsLinkRow
          row={{
            title: 'Drafts',
            description: 'Composer drafts Preview.',
            icon: 'text',
            route: '/drafts',
            preview: true,
          }}
        />
        <SettingsLinkRow
          row={{
            title: 'Export data',
            description: 'Greenfield repository export Preview.',
            icon: 'storage',
            route: '/settings/account/export',
            preview: true,
          }}
          last
        />
      </SettingsSection>
      <AppText variant="caption" colour="textTertiary">
        Estimated local cache: ~12 MB Preview · Clear cache is not wired.
      </AppText>
    </SettingsScreen>
  )
}

export function AboutScreen() {
  const router = useRouter()
  const {spacing} = useThemeTokens()
  return (
    <SettingsScreen
      title="About"
      caption="Version and release notes for this local shell."
      right={
        <SettingsOverflowMenu
          title="About"
          actions={[
            {id: 'whats-new', label: 'What’s New'},
            {id: 'help', label: 'Help & Support'},
            ...(canAccessDeveloperLabs()
              ? [{id: 'developer', label: 'Developer settings'}]
              : []),
          ]}
          onAction={id => {
            if (id === 'whats-new') router.push('/whats-new' as Href)
            if (id === 'help') router.push('/help' as Href)
            if (id === 'developer') router.push('/settings/developer' as Href)
          }}
        />
      }>
      <Pressable
        accessibilityLabel="Modula version"
        onLongPress={() => {
          if (canAccessDeveloperLabs()) {
            router.push('/settings/developer' as Href)
          }
        }}
        style={{gap: spacing[2]}}>
        <AppText variant="headline">Modula 0.1.0</AppText>
        <AppText variant="caption" colour="textSecondary">
          Phase 6S · Local / Simulator
          {canAccessDeveloperLabs() ? ' · Long-press for Developer' : ''}
        </AppText>
      </Pressable>
      <SettingsSection>
        <SettingsLinkRow
          row={{
            title: 'What’s New',
            description: 'Release notes.',
            icon: 'info',
            route: '/whats-new',
          }}
        />
        <SettingsLinkRow
          row={{
            title: 'Help & Support',
            description: 'Local help articles.',
            icon: 'info',
            route: '/help',
          }}
          last
        />
      </SettingsSection>
    </SettingsScreen>
  )
}

export function HelpSettingsScreen() {
  const router = useRouter()
  return (
    <SettingsScreen
      title="Help"
      caption="Support destinations for the local Modula shell."
      right={
        <SettingsOverflowMenu
          title="Help"
          actions={[
            {id: 'help', label: 'Help Center'},
            {id: 'whats-new', label: 'What’s New'},
            {id: 'shortcuts', label: 'Keyboard shortcuts'},
          ]}
          onAction={id => {
            if (id === 'help') router.push('/help' as Href)
            if (id === 'whats-new') router.push('/whats-new' as Href)
            if (id === 'shortcuts') router.push('/help/shortcuts' as Href)
          }}
        />
      }>
      <SettingsSection>
        <SettingsLinkRow
          row={{
            title: 'Help Center',
            description: 'Articles and FAQs.',
            icon: 'info',
            onPress: () => router.push('/help' as Href),
          }}
        />
        <SettingsLinkRow
          row={{
            title: 'What’s New',
            description: 'Release notes.',
            icon: 'info',
            route: '/whats-new',
          }}
        />
        <SettingsLinkRow
          row={{
            title: 'Keyboard shortcuts',
            description: 'Web and iPad Preview.',
            icon: 'tools',
            route: '/help/shortcuts',
            preview: true,
          }}
          last
        />
      </SettingsSection>
    </SettingsScreen>
  )
}

const styles = StyleSheet.create({
  banner: {
    borderWidth: StyleSheet.hairlineWidth,
  },
})
