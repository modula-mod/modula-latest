import {useState} from 'react'
import {Pressable, ScrollView, StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {MaterialSurface} from '@/components/materials/MaterialSurface'
import {AppText} from '@/components/primitives/AppText'
import {
  SettingsInfoBlock,
  SettingsLinkRow,
  SettingsSection,
  SettingsToggleRow,
} from '@/features/settings/components/SettingsRows'
import {isDevelopmentBuild} from '@/lib/platform'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

function SettingsPage({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  const {colours, spacing} = useThemeTokens()
  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title={title} />
      <ResponsiveContent>
        <ScrollView
          contentContainerStyle={[styles.content, {gap: spacing[5]}]}
          keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      </ResponsiveContent>
    </View>
  )
}

export function PrivacySafetyScreen() {
  const [privateAccount, setPrivateAccount] = useState(false)
  const [sensitiveMedia, setSensitiveMedia] = useState(true)
  return (
    <SettingsPage title="Privacy">
      <SettingsInfoBlock
        title="Privacy & Safety"
        body="Audience and trust controls for this local Modula build. Mute and block lists are Preview pages."
      />
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
    </SettingsPage>
  )
}

export function NotificationsSettingsScreen() {
  const [likes, setLikes] = useState(true)
  const [replies, setReplies] = useState(true)
  const [follows, setFollows] = useState(true)
  const [modules, setModules] = useState(false)
  const {colours, radius, spacing} = useThemeTokens()
  return (
    <SettingsPage title="Notifications">
      <SettingsInfoBlock
        title="Notifications"
        body="Local preference toggles. Device push is not connected in Phase 4.5."
      />
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
        <AppText variant="headline">Focus-aware bundling</AppText>
        <AppText variant="body" colour="textSub">
          Light Focus groups low-priority notifications into a calmer bundle. Deep
          Focus and Custom Focus can hold non-urgent activity until you return,
          while direct mentions and allowlisted people can still break through.
        </AppText>
      </MaterialSurface>
      <SettingsSection title="Activity">
        <SettingsToggleRow
          label="Likes"
          description="Show likes as individual activity unless Focus Mode bundles them."
          value={likes}
          onValueChange={setLikes}
          preview
        />
        <SettingsToggleRow
          label="Replies"
          description="Show replies and conversation updates when they are not held by Focus Mode."
          value={replies}
          onValueChange={setReplies}
          preview
        />
        <SettingsToggleRow
          label="Follows"
          description="Show new follows and relationship updates in Activity."
          value={follows}
          onValueChange={setFollows}
          preview
        />
        <SettingsToggleRow
          label="Module updates"
          description="Show module lifecycle and marketplace preview notifications."
          value={modules}
          onValueChange={setModules}
          last
          preview
        />
      </SettingsSection>
      <SettingsSection title="Related controls">
        <SettingsLinkRow
          row={{
            title: 'Focus Mode',
            description: 'Choose when notifications bundle, wait, or interrupt.',
            icon: 'contrast',
            route: '/product/focus',
            preview: true,
          }}
        />
        <SettingsLinkRow
          row={{
            title: 'Glass Privacy',
            description: 'Review message privacy levels that affect private notification context.',
            icon: 'privacy',
            route: '/product/glass-privacy',
            preview: true,
          }}
          last
        />
      </SettingsSection>
    </SettingsPage>
  )
}

export function ContentMediaScreen() {
  const [autoplay, setAutoplay] = useState(true)
  const [dataSaver, setDataSaver] = useState(false)
  return (
    <SettingsPage title="Content">
      <SettingsInfoBlock
        title="Content & Media"
        body="Playback and media preferences for the local shell."
      />
      <SettingsSection>
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
          last
          preview
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
    </SettingsPage>
  )
}

export function LanguageTranslateScreen() {
  const [preferOriginal, setPreferOriginal] = useState(true)
  const router = useRouter()
  return (
    <SettingsPage title="Language">
      <SettingsInfoBlock
        title="Language & Translate"
        body="Ties to post Translate Preview. No remote translation API is called."
      />
      <SettingsSection>
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
    </SettingsPage>
  )
}

export function MarketplacePreferencesScreen() {
  const [featured, setFeatured] = useState(true)
  const [creators, setCreators] = useState(true)
  const router = useRouter()
  return (
    <SettingsPage title="Marketplace">
      <SettingsInfoBlock
        title="Marketplace preferences"
        body="Local browse preferences for the seeded catalog. Install remains Preview."
      />
      <SettingsSection>
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
    </SettingsPage>
  )
}

export function DataStorageScreen() {
  return (
    <SettingsPage title="Data">
      <SettingsInfoBlock
        title="Data & storage"
        body="Local media, cache, and Saved content estimates for this device Preview."
      />
      <SettingsSection>
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
          last
        />
      </SettingsSection>
      <AppText variant="caption" colour="textSecondary">
        Estimated local cache: ~12 MB Preview · Clear cache is not wired.
      </AppText>
    </SettingsPage>
  )
}

export function AboutScreen() {
  const router = useRouter()
  const {spacing} = useThemeTokens()
  return (
    <SettingsPage title="About">
      <SettingsInfoBlock
        title="About Modula"
        body="Version and release notes for this local shell."
      />
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
          Phase 4.5 · Local / Simulator
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
    </SettingsPage>
  )
}

export function HelpSettingsScreen() {
  const router = useRouter()
  return (
    <SettingsPage title="Help">
      <SettingsInfoBlock title="Help" body="Support destinations for the local Modula shell." />
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
    </SettingsPage>
  )
}

const styles = StyleSheet.create({
  banner: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  screen: {
    flex: 1,
  },
})
