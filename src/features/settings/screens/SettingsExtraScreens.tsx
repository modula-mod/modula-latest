import {useState} from 'react'
import {Pressable, StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

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
import {isDevelopmentBuild} from '@/lib/platform'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function PrivacySafetyScreen() {
  const router = useRouter()
  const [privateAccount, setPrivateAccount] = useState(false)
  const [sensitiveMedia, setSensitiveMedia] = useState(true)

  return (
    <SettingsScreen
      title="Privacy"
      caption="Audience and trust controls for this local Modula build. Mute and block lists are Preview pages."
      right={
        <SettingsOverflowMenu
          title="Privacy"
          actions={[
            {id: 'mute', label: 'Mute words'},
            {id: 'blocked', label: 'Blocked accounts'},
            {id: 'report', label: 'Open report flow'},
          ]}
          onAction={id => {
            if (id === 'mute') router.push('/settings/mute-words' as Href)
            if (id === 'blocked') router.push('/settings/blocked' as Href)
            if (id === 'report') router.push('/report' as Href)
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
            description: 'Seeded mute list Preview.',
            icon: 'text',
            route: '/settings/mute-words',
            preview: true,
          }}
        />
        <SettingsLinkRow
          row={{
            title: 'Blocked accounts',
            description: 'Seeded block list Preview.',
            icon: 'privacy',
            route: '/settings/blocked',
            preview: true,
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
        />
        <SettingsLinkRow
          row={{
            title: 'Report flow',
            description: 'Multi-step report explanation.',
            icon: 'warning',
            route: '/report',
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
  const [likes, setLikes] = useState(true)
  const [replies, setReplies] = useState(true)
  const [follows, setFollows] = useState(true)
  const [modules, setModules] = useState(false)
  const [bundleStyle, setBundleStyle] = useState<'individual' | 'focus' | 'digest'>('focus')
  const {colours, radius, spacing} = useThemeTokens()

  const bundleLabel =
    bundleStyle === 'individual'
      ? 'Individual'
      : bundleStyle === 'digest'
        ? 'Digest'
        : 'Focus-aware'

  return (
    <SettingsScreen
      title="Notifications"
      caption="Local preference toggles. Device push is not connected yet."
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

      <SettingsSection title="Delivery">
        <SettingsMenuRow
          label="Bundling style"
          description="How Activity groups alerts."
          value={bundleLabel}
          preview
          actions={[
            {id: 'individual', label: 'Individual'},
            {id: 'focus', label: 'Focus-aware'},
            {id: 'digest', label: 'Daily digest Preview'},
          ]}
          onAction={id => {
            if (id === 'individual' || id === 'focus' || id === 'digest') {
              setBundleStyle(id)
            }
          }}
        />
      </SettingsSection>

      <SettingsSection title="Activity">
        <SettingsToggleRow
          label="Likes"
          description="Show likes unless Focus Mode bundles them."
          value={likes}
          onValueChange={setLikes}
          preview
        />
        <SettingsToggleRow
          label="Replies"
          description="Conversation updates when not held by Focus."
          value={replies}
          onValueChange={setReplies}
          preview
        />
        <SettingsToggleRow
          label="Follows"
          description="New follows and relationship updates."
          value={follows}
          onValueChange={setFollows}
          preview
        />
        <SettingsToggleRow
          label="Module updates"
          description="Module lifecycle and marketplace Preview."
          value={modules}
          onValueChange={setModules}
          last
          preview
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
            ...(isDevelopmentBuild()
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
          if (isDevelopmentBuild()) {
            router.push('/settings/developer' as Href)
          }
        }}
        style={{gap: spacing[2]}}>
        <AppText variant="headline">Modula 0.1.0</AppText>
        <AppText variant="caption" colour="textSecondary">
          Phase 6S · Local / Simulator
          {isDevelopmentBuild() ? ' · Long-press for Developer' : ''}
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
