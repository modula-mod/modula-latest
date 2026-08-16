import {useMemo, useState} from 'react'
import {Alert, Platform, ScrollView, StyleSheet, TextInput, View} from 'react-native'
import {useLocalSearchParams, useRouter, type Href} from 'expo-router'
import type {ReportCategory, ReportTargetType} from '@modula/api-contracts'

import {ProtectedActionPrompt} from '@/auth/components/ProtectedActionPrompt'
import {useCapability, useSession} from '@/auth/runtime'
import {AppIcon} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {EmptyState} from '@/components/primitives/EmptyState'
import {Surface} from '@/components/primitives/Surface'
import {
  GLASS_PRIVACY_LABELS,
  type GlassPrivacyLevel,
} from '@/features/product/data/glassPrivacyLabels'
import {useProductPreferences} from '@/features/product/hooks/useProductPreferences'
import {
  SettingsLinkRow,
  SettingsScreen as SettingsKitScreen,
  SettingsSection,
} from '@/features/settings/components/SettingsRows'
import {ModulaButton} from '@/platform/ui/buttons/modula-button'
import {ChromeOverflowMenu} from '@/platform/ui/menus/chrome-overflow-menu'
import {ModulaContextMenu} from '@/platform/ui/menus/modula-context-menu'
import {ModulaSheet} from '@/platform/ui/sheets/modula-sheet'
import {useFloatingTabBarContentPadding} from '@/platform/ui/navigation/floating-tab-bar-inset'
import {useAppServices} from '@/runtime'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type LocalThread = {
  id: string
  name: string
  handle: string
  preview: string
  timestamp: string
  unread: boolean
  pinned?: boolean
}

type LocalList = {
  id: string
  name: string
  description: string
  memberCount: number
  kind: 'people' | 'feed'
}

type LocalCollection = {
  id: string
  name: string
  description: string
  itemCount: number
}

type LocalCommunity = {
  id: string
  name: string
  description: string
  membersLabel: string
  topic: string
}

type LocalHelpArticle = {
  id: string
  title: string
  summary: string
  body: string[]
}

const seededMessageThreads: LocalThread[] = []
const seededLists: LocalList[] = []
const seededCollections: LocalCollection[] = []
const seededDrafts: {id: string; title: string; excerpt: string; updatedAt: string}[] = []
const seededCommunities: LocalCommunity[] = []
const seededInnerCircle: {id: string; name: string; handle: string}[] = []
const helpArticles: LocalHelpArticle[] = []
const whatsNewNotes: {version: string; items: string[]}[] = []

function getSeededThread(id: string) {
  return seededMessageThreads.find(thread => thread.id === id)
}

function getSeededList(id: string) {
  return seededLists.find(list => list.id === id)
}

function getSeededCollection(id: string) {
  return seededCollections.find(collection => collection.id === id)
}

function getSeededCommunity(id: string) {
  return seededCommunities.find(community => community.id === id)
}

function getHelpArticle(id: string) {
  return helpArticles.find(article => article.id === id)
}

function ScreenShell({
  title,
  children,
  right,
}: {
  title: string
  children: React.ReactNode
  right?: React.ReactNode
}) {
  const {colours, spacing} = useThemeTokens()
  const tabPadding = useFloatingTabBarContentPadding()
  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title={title} right={right} />
      <ResponsiveContent>
        <ScrollView
          contentContainerStyle={[styles.content, {gap: spacing[4], paddingBottom: tabPadding}]}
          keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      </ResponsiveContent>
    </View>
  )
}

function PreviewBanner({text}: {text: string}) {
  return (
    <AppText variant="caption" colour="textSecondary" style={styles.bannerText}>
      {text}
    </AppText>
  )
}

function getGlassPrivacyBannerText(level: GlassPrivacyLevel): string {
  if (level === 'vault-chat') {
    return 'Glass Privacy is set to Vault Chat. Chat Assist stays off by default, forwarding and export controls are blocked in this Preview, and the future sandbox requirement is made explicit.'
  }

  if (level === 'protected-chat') {
    return 'Glass Privacy is set to Protected Chat. Forwarding stays restricted in this Preview, privacy events are logged locally, and future limited-forward checks are clearly marked as planned.'
  }

  return 'Glass Privacy is set to Disable Sharing. Forwarding and export controls are restricted wherever this local Preview can enforce them.'
}

function getQuietSendBannerText(): string {
  return 'Quiet Send is holding non-urgent message drafts locally while Focus or Quiet Send is active. This Preview never sends messages remotely.'
}

function getChatAssistBannerText(mode: string): string {
  return `Chat Assist is set to ${mode}. Conversation intelligence is permission-controlled, stays local to this Preview, and remains off unless you choose an assist mode.`
}

function getForwardRestrictionReason(level: GlassPrivacyLevel): string {
  if (level === 'vault-chat') {
    return 'Vault Chat is active, so forwarding is disabled until the planned sandbox and verified-participant flow exist.'
  }

  if (level === 'protected-chat') {
    return 'Protected Chat is active, so forwarding stays disabled in this Preview until limited-forward consent and device checks exist.'
  }

  return 'Disable Sharing is active, so forwarding and export controls are restricted for this local Preview thread.'
}

function getInboxEmptyState(
  filter: 'all' | 'unread' | 'pinned',
  query: string,
): {title: string; description: string} | null {
  if (query.trim()) {
    return {
      title: 'No conversations match this search.',
      description: 'Try a different name, handle, or message preview in this seeded inbox.',
    }
  }

  if (filter === 'unread') {
    return {
      title: 'There are no unread conversations right now.',
      description: 'Seeded Preview threads are still available when you switch the filter back to All.',
    }
  }

  if (filter === 'pinned') {
    return {
      title: 'There are no pinned conversations right now.',
      description: 'Pin a seeded Preview thread from its actions menu, or switch back to All.',
    }
  }

  return {
    title: 'There are no conversations in this local Preview inbox yet.',
    description: 'Messages remain seeded in this build, and no remote inbox is connected.',
  }
}

export function MessagesInboxScreen() {
  const canAccess = useCapability('messages:access')
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()
  const {preferences} = useProductPreferences()
  const glass = GLASS_PRIVACY_LABELS[preferences.glassPrivacyLevel]
  const [filter, setFilter] = useState<'all' | 'unread' | 'pinned'>('all')
  const [query, setQuery] = useState('')
  const [newMessageOpen, setNewMessageOpen] = useState(false)
  const [pinnedIds, setPinnedIds] = useState(
    () => new Set(seededMessageThreads.filter(t => t.pinned).map(t => t.id)),
  )

  const threads = useMemo(() => {
    const q = query.trim().toLowerCase()
    return seededMessageThreads
      .filter(thread => {
        if (filter === 'unread' && !thread.unread) return false
        if (filter === 'pinned' && !pinnedIds.has(thread.id)) return false
        if (!q) return true
        return (
          thread.name.toLowerCase().includes(q) ||
          thread.handle.toLowerCase().includes(q) ||
          thread.preview.toLowerCase().includes(q)
        )
      })
      .sort((a, b) => Number(pinnedIds.has(b.id)) - Number(pinnedIds.has(a.id)))
  }, [filter, pinnedIds, query])
  const emptyState = threads.length === 0 ? getInboxEmptyState(filter, query) : null

  if (!canAccess) {
    return (
      <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
        <SecondaryScreenHeader title="Messages" />
        <ProtectedActionPrompt
          visible
          description="Sign in to open the local Messages inbox preview."
        />
      </View>
    )
  }

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader
        title="Messages"
        right={
          <ChromeOverflowMenu
            accessibilityLabel="Filter messages"
            title="Filter"
            actions={[
              {id: 'all', label: 'All', icon: 'messages'},
              {id: 'unread', label: 'Unread', icon: 'activity'},
              {id: 'pinned', label: 'Pinned', icon: 'bookmark'},
            ]}
            onAction={id => setFilter(id as 'all' | 'unread' | 'pinned')}
          />
        }
      />
      <ResponsiveContent>
        <ScrollView
          contentContainerStyle={[styles.content, {gap: spacing[4], paddingBottom: 112}]}
          keyboardShouldPersistTaps="handled">
          <AppText variant="display">Inbox</AppText>
          <PreviewBanner text="Seeded conversations — Preview. No messages are sent remotely." />
          <AppPressable
            accessibilityLabel="Open Glass Privacy levels"
            onPress={() => router.push('/product/glass-privacy' as Href)}
            style={[
              styles.glassBadge,
              {
                backgroundColor: colours.accentSubtle,
                borderColor: colours.accentBorder,
                borderRadius: radius.medium,
                paddingHorizontal: spacing[3],
                paddingVertical: spacing[2],
                gap: spacing[2],
              },
            ]}>
            <AppIcon name="privacy" colour={colours.accent} size={16} />
            <View style={styles.flex}>
              <AppText variant="caption" colour="accent">
                {glass.short} · local
              </AppText>
              <AppText variant="caption" colour="textSecondary">
                {getGlassPrivacyBannerText(preferences.glassPrivacyLevel)}
              </AppText>
            </View>
          </AppPressable>
          {(preferences.quietSendEnabled ||
            preferences.focus.preset === 'deep' ||
            preferences.focus.preset === 'custom') && (
            <AppPressable
              accessibilityLabel="Open Quiet Send and Chat Assist"
              onPress={() => router.push('/product/chat-assist' as Href)}
              style={[
                styles.glassBadge,
                {
                  backgroundColor: colours.surface,
                  borderColor: colours.border,
                  borderRadius: radius.medium,
                  paddingHorizontal: spacing[3],
                  paddingVertical: spacing[2],
                  gap: spacing[2],
                },
              ]}>
              <AppIcon name="messages" colour={colours.accent} size={16} />
              <View style={styles.flex}>
                <AppText variant="caption" colour="accent">
                  Quiet Send · held locally
                </AppText>
                <AppText variant="caption" colour="textSecondary">
                  {getQuietSendBannerText()}
                </AppText>
              </View>
            </AppPressable>
          )}
          <AppPressable
            accessibilityLabel="Open Chat Assist permissions"
            onPress={() => router.push('/product/chat-assist' as Href)}
            style={[
              styles.glassBadge,
              {
                backgroundColor: colours.surface,
                borderColor: colours.border,
                borderRadius: radius.medium,
                paddingHorizontal: spacing[3],
                paddingVertical: spacing[2],
                gap: spacing[2],
              },
            ]}>
            <AppIcon name="automation" colour={colours.accent} size={16} />
            <View style={styles.flex}>
              <AppText variant="caption" colour="accent">
                Chat Assist · {preferences.chatAssistMode}
              </AppText>
              <AppText variant="caption" colour="textSecondary">
                {getChatAssistBannerText(preferences.chatAssistMode)}
              </AppText>
            </View>
          </AppPressable>
          <View
            style={[
              styles.searchRow,
              {
                backgroundColor: colours.surfaceMuted,
                borderRadius: radius.round,
                gap: spacing[2],
                paddingHorizontal: spacing[3],
              },
            ]}>
            <AppIcon name="search" colour={colours.textTertiary} size={18} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search messages"
              placeholderTextColor={colours.textTertiary}
              accessibilityLabel="Search messages"
              style={[styles.searchInput, {color: colours.text}]}
            />
          </View>
          <AppText variant="caption" colour="textSecondary">
            Filter: {filter === 'all' ? 'All' : filter === 'unread' ? 'Unread' : 'Pinned'}
          </AppText>
          {emptyState ? (
            <EmptyState
              icon="messages"
              title={emptyState.title}
              description={emptyState.description}
            />
          ) : null}
          {threads.map(thread => (
            <ModulaContextMenu
              key={thread.id}
              accessibilityLabel={`${thread.name} conversation actions`}
              actions={[
                {
                  id: 'pin',
                  label: pinnedIds.has(thread.id) ? 'Unpin' : 'Pin',
                },
                {id: 'mute', label: 'Mute preview'},
                {id: 'delete', label: 'Delete preview', style: 'destructive'},
              ]}
              onAction={id => {
                if (id === 'pin') {
                  setPinnedIds(prev => {
                    const next = new Set(prev)
                    if (next.has(thread.id)) next.delete(thread.id)
                    else next.add(thread.id)
                    return next
                  })
                }
              }}>
              <AppPressable
                accessibilityLabel={`Open conversation with ${thread.name}`}
                onPress={() => router.push(`/messages/${thread.id}` as Href)}
                style={[
                  styles.row,
                  {
                    backgroundColor: colours.surfaceRaised,
                    borderColor: colours.border,
                    borderRadius: radius.large,
                    padding: spacing[4],
                    gap: spacing[3],
                  },
                ]}>
                <View
                  style={[
                    styles.avatar,
                    {backgroundColor: colours.accentSubtle, borderRadius: radius.round},
                  ]}>
                  <AppIcon name="messages" colour={colours.accent} />
                </View>
                <View style={styles.flex}>
                  <AppText variant="label">
                    {pinnedIds.has(thread.id) ? 'Pinned · ' : ''}
                    {thread.name}
                    {thread.unread ? ' · Unread' : ''}
                  </AppText>
                  <AppText variant="caption" colour="textSecondary">
                    {thread.preview}
                  </AppText>
                </View>
                <AppText variant="caption" colour="textTertiary">
                  {thread.timestamp}
                </AppText>
              </AppPressable>
            </ModulaContextMenu>
          ))}
        </ScrollView>
      </ResponsiveContent>
      <AppPressable
        accessibilityLabel="New message Preview"
        onPress={() => setNewMessageOpen(true)}
        style={[
          styles.fab,
          {
            backgroundColor: colours.accent,
            borderRadius: radius.round,
          },
        ]}>
        <AppIcon name="create" colour={colours.accentForeground} />
      </AppPressable>
      <ModulaSheet
        isPresented={newMessageOpen}
        onDismiss={() => setNewMessageOpen(false)}
        snapPoints={['half', 'full']}
        testID="new-message-sheet">
        <AppText variant="headline">New message</AppText>
        <PreviewBanner text="Compose a DM — Preview. Nothing is sent remotely." />
        {seededMessageThreads.map(person => (
          <AppPressable
            key={`new-${person.id}`}
            accessibilityLabel={`Message ${person.name} Preview`}
            onPress={() => {
              setNewMessageOpen(false)
              router.push(`/messages/${person.id}` as Href)
            }}
            style={[styles.row, {paddingVertical: spacing[3], gap: spacing[3]}]}>
            <AppIcon name="messages" colour={colours.accent} />
            <View style={styles.flex}>
              <AppText variant="label">{person.name}</AppText>
              <AppText variant="caption" colour="textSecondary">
                @{person.handle}
              </AppText>
            </View>
          </AppPressable>
        ))}
      </ModulaSheet>
    </View>
  )
}

export function MessageThreadScreen() {
  const {threadId} = useLocalSearchParams<{threadId: string}>()
  const thread = getSeededThread(String(threadId ?? ''))
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()
  const {preferences} = useProductPreferences()
  const glass = GLASS_PRIVACY_LABELS[preferences.glassPrivacyLevel]
  const forwardRestrictionReason = getForwardRestrictionReason(preferences.glassPrivacyLevel)

  if (!thread) {
    return (
      <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
        <SecondaryScreenHeader title="Conversation" />
        <EmptyState
          icon="messages"
          title="This conversation was not found."
          description="This seeded thread is not in the local inbox preview."
        />
      </View>
    )
  }

  return (
    <ScreenShell
      title={thread.name}
      right={
        <ChromeOverflowMenu
          accessibilityLabel="Thread actions"
          title="Thread actions"
          actions={[
            {
              id: 'forward',
              label: 'Forward',
              icon: 'share',
              disabled: true,
              disabledReason: forwardRestrictionReason,
            },
            {id: 'mute', label: 'Mute preview', icon: 'notifications'},
            {id: 'delete', label: 'Delete preview', icon: 'trash', style: 'destructive'},
          ]}
          onAction={id => {
            if (id === 'forward') {
              Alert.alert(
                'Forward Preview',
                'Forwarding is not connected to a remote messaging service in this Preview.',
              )
            }
          }}
        />
      }>
      <AppText variant="headline">@{thread.handle}</AppText>
      <PreviewBanner text="Conversation Preview — replies are not delivered." />
      <AppPressable
        accessibilityLabel="Open Glass Privacy levels"
        onPress={() => router.push('/product/glass-privacy' as Href)}
        style={[
          styles.glassBadge,
          {
            backgroundColor: colours.accentSubtle,
            borderColor: colours.accentBorder,
            borderRadius: radius.medium,
            paddingHorizontal: spacing[3],
            paddingVertical: spacing[2],
            gap: spacing[2],
          },
        ]}>
        <AppIcon name="privacy" colour={colours.accent} size={16} />
        <View style={styles.flex}>
          <AppText variant="caption" colour="accent">
            {glass.short}
          </AppText>
          <AppText variant="caption" colour="textSecondary">
            {getGlassPrivacyBannerText(preferences.glassPrivacyLevel)}
          </AppText>
        </View>
      </AppPressable>
      <Surface variant="contained" style={{padding: spacing[4], gap: spacing[2]}}>
        <AppText variant="body">{thread.preview}</AppText>
        <AppText variant="caption" colour="textSecondary">
          {thread.timestamp}
        </AppText>
      </Surface>
      <ModulaButton
        label="Reply — Preview"
        role="secondary"
        onPress={() => undefined}
      />
    </ScreenShell>
  )
}

export function ListsScreen() {
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()
  return (
    <ScreenShell title="Lists">
      <AppText variant="display">Lists</AppText>
      <PreviewBanner text="Custom lists and feeds — Preview with seeded members." />
      {seededLists.map(list => (
        <AppPressable
          key={list.id}
          accessibilityLabel={`Open list ${list.name}`}
          onPress={() => router.push(`/lists/${list.id}` as Href)}
          style={[
            styles.row,
            {
              backgroundColor: colours.surfaceRaised,
              borderColor: colours.border,
              borderRadius: radius.large,
              padding: spacing[4],
              gap: spacing[3],
            },
          ]}>
          <AppIcon name="people" colour={colours.accent} />
          <View style={styles.flex}>
            <AppText variant="label">{list.name}</AppText>
            <AppText variant="caption" colour="textSecondary">
              {list.description}
            </AppText>
          </View>
          <AppText variant="caption" colour="accent">
            {list.memberCount}
          </AppText>
        </AppPressable>
      ))}
    </ScreenShell>
  )
}

export function ListDetailScreen() {
  const {listId} = useLocalSearchParams<{listId: string}>()
  const list = getSeededList(String(listId ?? ''))
  const {colours, spacing} = useThemeTokens()
  if (!list) {
    return (
      <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
        <SecondaryScreenHeader title="List" />
        <EmptyState icon="people" title="List not found" description="Unknown list id." />
      </View>
    )
  }
  return (
    <ScreenShell title={list.name}>
      <AppText variant="display">{list.name}</AppText>
      <AppText variant="body" colour="textSecondary">
        {list.description}
      </AppText>
      <PreviewBanner
        text={`${list.kind === 'feed' ? 'Custom feed' : 'People list'} · ${list.memberCount} members · Preview`}
      />
      {Array.from({length: Math.min(list.memberCount, 5)}).map((_, index) => (
        <Surface key={index} variant="plain" style={[styles.row, {gap: spacing[3]}]}>
          <AppIcon name="profile" colour={colours.textSecondary} />
          <AppText variant="body">Member preview {index + 1}</AppText>
        </Surface>
      ))}
    </ScreenShell>
  )
}

export function CollectionsScreen() {
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()
  return (
    <ScreenShell title="Collections">
      <AppText variant="display">Saved collections</AppText>
      <PreviewBanner text="Organize Saved items into collections — Preview." />
      <ModulaButton
        label="Open Saved posts"
        role="secondary"
        onPress={() => router.push('/saved' as Href)}
      />
      {seededCollections.map(collection => (
        <AppPressable
          key={collection.id}
          accessibilityLabel={`Open collection ${collection.name}`}
          onPress={() => router.push(`/collections/${collection.id}` as Href)}
          style={[
            styles.row,
            {
              backgroundColor: colours.surfaceRaised,
              borderColor: colours.border,
              borderRadius: radius.large,
              padding: spacing[4],
              gap: spacing[3],
            },
          ]}>
          <AppIcon name="bookmark" colour={colours.accent} />
          <View style={styles.flex}>
            <AppText variant="label">{collection.name}</AppText>
            <AppText variant="caption" colour="textSecondary">
              {collection.description}
            </AppText>
          </View>
          <AppText variant="caption" colour="accent">
            {collection.itemCount}
          </AppText>
        </AppPressable>
      ))}
    </ScreenShell>
  )
}

export function CollectionDetailScreen() {
  const {collectionId} = useLocalSearchParams<{collectionId: string}>()
  const collection = getSeededCollection(String(collectionId ?? ''))
  const router = useRouter()
  const {colours} = useThemeTokens()
  if (!collection) {
    return (
      <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
        <SecondaryScreenHeader title="Collection" />
        <EmptyState icon="bookmark" title="Collection not found" description="Unknown collection." />
      </View>
    )
  }
  return (
    <ScreenShell title={collection.name}>
      <AppText variant="display">{collection.name}</AppText>
      <AppText variant="body" colour="textSecondary">
        {collection.description}
      </AppText>
      <PreviewBanner text={`${collection.itemCount} seeded items · Preview`} />
      <ModulaButton
        label="Browse Saved"
        role="primary"
        onPress={() => router.push('/saved' as Href)}
      />
      <ModulaButton
        label="Browse Marketplace"
        role="secondary"
        onPress={() => router.push('/marketplace' as Href)}
      />
    </ScreenShell>
  )
}

export function DraftsScreen() {
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()
  return (
    <ScreenShell title="Drafts">
      <AppText variant="display">Drafts</AppText>
      <PreviewBanner text="Local composer drafts — Preview. Resume opens Composer." />
      {seededDrafts.map(draft => (
        <AppPressable
          key={draft.id}
          accessibilityLabel={`Resume draft ${draft.title}`}
          onPress={() => router.push('/compose' as Href)}
          style={[
            styles.row,
            {
              backgroundColor: colours.surfaceRaised,
              borderColor: colours.border,
              borderRadius: radius.large,
              padding: spacing[4],
              gap: spacing[3],
            },
          ]}>
          <AppIcon name="text" colour={colours.accent} />
          <View style={styles.flex}>
            <AppText variant="label">{draft.title}</AppText>
            <AppText variant="caption" colour="textSecondary" numberOfLines={2}>
              {draft.excerpt}
            </AppText>
          </View>
          <AppText variant="caption" colour="textTertiary">
            {draft.updatedAt}
          </AppText>
        </AppPressable>
      ))}
    </ScreenShell>
  )
}

export function CommunitiesHomeScreen() {
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()
  return (
    <ScreenShell title="Communities">
      <AppText variant="display">Communities</AppText>
      <PreviewBanner text="Topic communities — Preview. Each row opens a real topic page." />
      {seededCommunities.map(community => (
        <AppPressable
          key={community.id}
          accessibilityLabel={`Open ${community.name}`}
          onPress={() => router.push(`/communities/${community.id}` as Href)}
          style={[
            styles.row,
            {
              backgroundColor: colours.surfaceRaised,
              borderColor: colours.border,
              borderRadius: radius.large,
              padding: spacing[4],
              gap: spacing[3],
            },
          ]}>
          <AppIcon name="community" colour={colours.accent} />
          <View style={styles.flex}>
            <AppText variant="label">{community.name}</AppText>
            <AppText variant="caption" colour="textSecondary">
              {community.description}
            </AppText>
          </View>
          <AppText variant="caption" colour="accent">
            {community.membersLabel}
          </AppText>
        </AppPressable>
      ))}
    </ScreenShell>
  )
}

export function CommunityTopicScreen() {
  const {topicId} = useLocalSearchParams<{topicId: string}>()
  const community = getSeededCommunity(String(topicId ?? ''))
  const router = useRouter()
  const {colours} = useThemeTokens()
  if (!community) {
    return (
      <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
        <SecondaryScreenHeader title="Community" />
        <EmptyState icon="community" title="Community not found" description="Unknown topic." />
      </View>
    )
  }
  return (
    <ScreenShell title={community.name}>
      <AppText variant="display">{community.name}</AppText>
      <AppText variant="body" colour="textSecondary">
        {community.description}
      </AppText>
      <PreviewBanner
        text={`${community.topic} · ${community.membersLabel} · Preview community`}
      />
      <ModulaButton
        label="Discover more"
        role="secondary"
        onPress={() => router.push('/discover' as Href)}
      />
      <ModulaButton
        label="Browse Marketplace"
        role="secondary"
        onPress={() => router.push('/marketplace' as Href)}
      />
    </ScreenShell>
  )
}

export function MuteWordsScreen() {
  return (
    <SettingsKitScreen
      title="Mute words"
      caption="Mute words are not available yet. There is no Greenfield mute-words API. Use Mute account on a post to mute a profile.">
      <SettingsSection title="Status">
        <EmptyState
          title="Unavailable"
          description="Word mutes are not shipped. No local preview list is shown so this cannot look like a working feature."
        />
      </SettingsSection>
    </SettingsKitScreen>
  )
}

export function BlockedAccountsScreen() {
  return (
    <SettingsKitScreen
      title="Blocked accounts"
      caption="Blocking works from post overflow (Block account). A blocked-accounts list endpoint is not available yet, so this screen does not invent entries.">
      <SettingsSection title="Status">
        <EmptyState
          title="List unavailable"
          description="Use Block account on someone else's post. When a list API ships, blocked profiles will appear here."
        />
      </SettingsSection>
    </SettingsKitScreen>
  )
}

export function InnerCircleScreen() {
  const router = useRouter()
  return (
    <SettingsKitScreen
      title="Inner circle"
      caption="Close friends style audience — Preview.">
      <SettingsSection title="People">
        {seededInnerCircle.map((person, index) => (
          <SettingsLinkRow
            key={person.id}
            last={index === seededInnerCircle.length - 1}
            row={{
              title: person.name,
              description: `@${person.handle}`,
              icon: 'community',
              preview: true,
              onPress: () => router.push(`/profile/${person.handle}` as Href),
            }}
          />
        ))}
      </SettingsSection>
    </SettingsKitScreen>
  )
}

export function CreatorStudioScreen() {
  const router = useRouter()
  return (
    <ScreenShell title="Creator Studio">
      <AppText variant="display">Creator Studio</AppText>
      <PreviewBanner text="Insights and monetization entry — Preview." />
      <ModulaButton
        label="Open Insights"
        role="primary"
        onPress={() => router.push('/creator/insights' as Href)}
      />
      <ModulaButton
        label="Monetization — Preview"
        role="secondary"
        onPress={() => router.push('/creator/monetization' as Href)}
      />
      <ModulaButton
        label="Marketplace tools"
        role="secondary"
        onPress={() => router.push('/marketplace' as Href)}
      />
    </ScreenShell>
  )
}

export function CreatorInsightsScreen() {
  const {spacing} = useThemeTokens()
  return (
    <ScreenShell title="Insights">
      <AppText variant="display">Insights</AppText>
      <PreviewBanner text="Seeded engagement metrics — not production analytics." />
      {[
        ['Profile visits', '128'],
        ['Post impressions', '1.4k'],
        ['Marketplace views', '86'],
        ['Saves', '34'],
      ].map(([label, value]) => (
        <Surface key={label} variant="contained" style={{padding: spacing[4], gap: spacing[1]}}>
          <AppText variant="caption" colour="textSecondary">
            {label}
          </AppText>
          <AppText variant="headline">{value}</AppText>
        </Surface>
      ))}
    </ScreenShell>
  )
}

export function MonetizationPreviewScreen() {
  return (
    <ScreenShell title="Monetization">
      <AppText variant="display">Monetization</AppText>
      <PreviewBanner text="Creator payouts and tips are not enabled. This page explains future intent only." />
      <ModulaButton label="Learn about Creator Studio" role="secondary" onPress={() => undefined} />
    </ScreenShell>
  )
}

export function HelpCenterScreen() {
  const router = useRouter()
  const {colours, spacing} = useThemeTokens()
  return (
    <ScreenShell title="Help">
      <AppText variant="display">Help & Support</AppText>
      <PreviewBanner text="Local help articles — Preview." />
      {helpArticles.map(article => (
        <AppPressable
          key={article.id}
          accessibilityLabel={article.title}
          onPress={() => router.push(`/help/${article.id}` as Href)}
          style={[styles.row, {gap: spacing[3], minHeight: 56}]}>
          <AppIcon name="info" colour={colours.accent} />
          <View style={styles.flex}>
            <AppText variant="label">{article.title}</AppText>
            <AppText variant="caption" colour="textSecondary">
              {article.summary}
            </AppText>
          </View>
          <AppIcon name="chevronRight" colour={colours.textTertiary} size={18} />
        </AppPressable>
      ))}
      <ModulaButton
        label="What’s New"
        role="secondary"
        onPress={() => router.push('/whats-new' as Href)}
      />
      {Platform.OS === 'web' || Platform.OS === 'ios' ? (
        <ModulaButton
          label="Keyboard shortcuts"
          role="secondary"
          onPress={() => router.push('/help/shortcuts' as Href)}
        />
      ) : null}
    </ScreenShell>
  )
}

export function HelpArticleScreen() {
  const {articleId} = useLocalSearchParams<{articleId: string}>()
  const article = getHelpArticle(String(articleId ?? ''))
  const {colours, spacing} = useThemeTokens()
  if (!article) {
    return (
      <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
        <SecondaryScreenHeader title="Help" />
        <EmptyState icon="info" title="Article not found" description="Unknown help article." />
      </View>
    )
  }
  return (
    <ScreenShell title="Help">
      <AppText variant="display">{article.title}</AppText>
      <AppText variant="body" colour="textSecondary">
        {article.summary}
      </AppText>
      {article.body.map(paragraph => (
        <AppText key={paragraph} variant="body">
          {paragraph}
        </AppText>
      ))}
      <View style={{height: spacing[2]}} />
    </ScreenShell>
  )
}

export function WhatsNewScreen() {
  const {spacing} = useThemeTokens()
  return (
    <ScreenShell title="What’s New">
      {whatsNewNotes.map(note => (
        <View key={note.version} style={{gap: spacing[3]}}>
          <AppText variant="display">{note.version}</AppText>
          {note.items.map(item => (
            <Surface key={item} variant="contained" style={{padding: spacing[4]}}>
              <AppText variant="body">{item}</AppText>
            </Surface>
          ))}
        </View>
      ))}
    </ScreenShell>
  )
}

export function KeyboardShortcutsScreen() {
  const shortcuts = [
    ['⌘ K', 'Open search / Discover'],
    ['⌘ N', 'New post (Composer)'],
    ['⌘ ,', 'Settings'],
    ['G then H', 'Go Home'],
    ['G then D', 'Go Discover'],
    ['?', 'This shortcuts sheet'],
  ]
  const {spacing} = useThemeTokens()
  return (
    <ScreenShell title="Shortcuts">
      <AppText variant="display">Keyboard shortcuts</AppText>
      <PreviewBanner text="Documented for web/iPad Preview. Bindings are not fully wired yet." />
      {shortcuts.map(([key, action]) => (
        <Surface
          key={key}
          variant="contained"
          style={[styles.row, {padding: spacing[4], justifyContent: 'space-between'}]}>
          <AppText variant="label">{key}</AppText>
          <AppText variant="body" colour="textSecondary">
            {action}
          </AppText>
        </Surface>
      ))}
    </ScreenShell>
  )
}

export function AccountSwitcherScreen() {
  const {colours, spacing} = useThemeTokens()
  const sessionAccounts = [
    {id: 'primary', label: 'Primary local account', handle: 'you'},
    {id: 'guest', label: 'Guest browsing', handle: 'guest'},
  ]
  return (
    <ScreenShell title="Accounts">
      <AppText variant="display">Account switcher</AppText>
      <PreviewBanner text="Multi-account switching is Preview — selection is local only." />
      {sessionAccounts.map(account => (
        <Surface
          key={account.id}
          variant="contained"
          style={[styles.row, {padding: spacing[4], gap: spacing[3]}]}>
          <AppIcon name="switch" colour={colours.accent} />
          <View style={styles.flex}>
            <AppText variant="label">{account.label}</AppText>
            <AppText variant="caption" colour="textSecondary">
              @{account.handle}
            </AppText>
          </View>
        </Surface>
      ))}
    </ScreenShell>
  )
}

export function ShareProfileSheetScreen() {
  const [presented, setPresented] = useState(true)
  const router = useRouter()
  const session = useSession()
  const {colours, spacing} = useThemeTokens()
  const handle = session.status === 'signedIn' ? session.profile.handle : 'andrei.modula'
  const displayName = session.status === 'signedIn' ? session.profile.displayName : 'Modula Founder'
  const profileUrl = `https://modula.digital/@${handle}`
  const copyProfileLink = async () => {
    await import('expo-clipboard').then(mod => mod.setStringAsync(profileUrl))
    Alert.alert('Profile link copied', profileUrl)
  }
  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title="Share profile" />
      <ModulaSheet
        isPresented={presented}
        onDismiss={() => {
          setPresented(false)
          if (router.canGoBack()) router.back()
        }}
        snapPoints={['half', 'full']}>
        <View style={{gap: spacing[3]}}>
          <AppText variant="headline">Share profile</AppText>
          <AppText variant="body" colour="textSecondary">
            Share your current Modula profile link.
          </AppText>
          <Surface variant="contained" style={{padding: spacing[5], alignItems: 'center', gap: spacing[2]}}>
            <AppIcon name="share" colour={colours.accent} size={48} />
            <AppText variant="label">{displayName}</AppText>
            <AppText variant="caption" colour="textSecondary">
              {profileUrl}
            </AppText>
          </Surface>
          <ModulaButton
            label="Copy profile link"
            role="primary"
            onPress={() => void copyProfileLink()}
          />
          <ModulaButton
            label="Close"
            role="secondary"
            onPress={() => {
              setPresented(false)
              if (router.canGoBack()) router.back()
            }}
          />
        </View>
      </ModulaSheet>
    </View>
  )
}

export function ReportFlowScreen() {
  const params = useLocalSearchParams<{
    targetType?: string
    targetId?: string
  }>()
  const router = useRouter()
  const session = useSession()
  const {moderationRepository} = useAppServices()
  const {colours, spacing} = useThemeTokens()
  const [step, setStep] = useState(0)
  const [category, setCategory] = useState<ReportCategory | null>(null)
  const [details, setDetails] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [submittedReportId, setSubmittedReportId] = useState<string | null>(null)

  const targetType: ReportTargetType =
    params.targetType === 'profile' ||
    params.targetType === 'post' ||
    params.targetType === 'message' ||
    params.targetType === 'other'
      ? params.targetType
      : 'post'
  const targetId = typeof params.targetId === 'string' ? params.targetId.trim() : ''

  const categories: {id: ReportCategory; label: string}[] = [
    {id: 'spam', label: 'Spam'},
    {id: 'harassment', label: 'Harassment'},
    {id: 'impersonation', label: 'Impersonation'},
    {id: 'illegal-content', label: 'Illegal content'},
    {id: 'privacy', label: 'Privacy'},
    {id: 'other', label: 'Other'},
  ]

  const submit = async () => {
    if (!category || !targetId || session.status !== 'signedIn') return
    setSubmitting(true)
    setErrorMessage(null)
    try {
      const report = await moderationRepository.createReport({
        targetType,
        targetId,
        category,
        details: details.trim() || undefined,
      })
      setSubmittedReportId(report.id)
      setStep(2)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Report failed.')
    } finally {
      setSubmitting(false)
    }
  }

  if (session.status !== 'signedIn') {
    return (
      <ScreenShell title="Report">
        <EmptyState
          title="Sign in to report"
          description="Reports are submitted to Greenfield and require an authenticated session."
          action={
            <ModulaButton label="Sign in" role="primary" onPress={() => router.push('/sign-in' as Href)} />
          }
        />
      </ScreenShell>
    )
  }

  if (!targetId) {
    return (
      <ScreenShell title="Report">
        <EmptyState
          title="Nothing to report"
          description="Open Report from a post. This screen does not invent a target."
        />
        <ModulaButton
          label="Close"
          role="secondary"
          onPress={() => {
            if (router.canGoBack()) router.back()
          }}
        />
      </ScreenShell>
    )
  }

  return (
    <ScreenShell title="Report">
      <AppText variant="display">Report</AppText>
      <AppText variant="caption" colour="textSecondary">
        {targetType} · {targetId}
      </AppText>
      <AppText variant="caption" colour="textSecondary">
        Step {Math.min(step + 1, 3)} of 3
      </AppText>
      {step === 0 ? (
        <View style={{gap: spacing[2]}}>
          {categories.map(item => (
            <AppPressable
              key={item.id}
              accessibilityLabel={item.label}
              onPress={() => {
                setCategory(item.id)
                setStep(1)
              }}
              style={[
                styles.row,
                {
                  minHeight: 48,
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: colours.separator,
                },
              ]}>
              <AppText variant="body">{item.label}</AppText>
            </AppPressable>
          ))}
        </View>
      ) : null}
      {step === 1 ? (
        <View style={{gap: spacing[3]}}>
          <AppText variant="body">
            Category: {categories.find(item => item.id === category)?.label ?? category}
          </AppText>
          <TextInput
            value={details}
            onChangeText={setDetails}
            placeholder="Optional details"
            placeholderTextColor={colours.textTertiary}
            multiline
            accessibilityLabel="Report details"
            style={{
              minHeight: 96,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: colours.border,
              borderRadius: 12,
              padding: spacing[3],
              color: colours.text,
            }}
          />
          {errorMessage ? (
            <AppText variant="caption" colour="textSecondary">
              {errorMessage}
            </AppText>
          ) : null}
          <ModulaButton
            label={submitting ? 'Submitting…' : 'Submit report'}
            role="primary"
            disabled={submitting || !category}
            onPress={() => void submit()}
          />
          <ModulaButton label="Back" role="secondary" onPress={() => setStep(0)} />
        </View>
      ) : null}
      {step === 2 ? (
        <View style={{gap: spacing[3]}}>
          <AppText variant="body">
            Report submitted{submittedReportId ? ` (${submittedReportId})` : ''}.
          </AppText>
          <ModulaButton
            label="Done"
            role="primary"
            onPress={() => {
              if (router.canGoBack()) router.back()
            }}
          />
        </View>
      ) : null}
    </ScreenShell>
  )
}

export function StickerReactionScreen() {
  const stickers = ['✦', '◎', '△', '◇', '☆']
  const {colours, radius, spacing} = useThemeTokens()
  return (
    <ScreenShell title="Reactions">
      <AppText variant="display">Sticker picker</AppText>
      <PreviewBanner text="Restrained reaction Preview — not uploaded." />
      <View style={[styles.stickerGrid, {gap: spacing[3]}]}>
        {stickers.map(sticker => (
          <AppPressable
            key={sticker}
            accessibilityLabel={`Reaction ${sticker}`}
            style={[
              styles.sticker,
              {
                backgroundColor: colours.surfaceRaised,
                borderColor: colours.border,
                borderRadius: radius.large,
              },
            ]}>
            <AppText variant="display">{sticker}</AppText>
          </AppPressable>
        ))}
      </View>
    </ScreenShell>
  )
}

export function PostAnalyticsScreen() {
  const {postId} = useLocalSearchParams<{postId: string}>()
  const {spacing} = useThemeTokens()
  return (
    <ScreenShell title="Engagement">
      <AppText variant="display">Post analytics</AppText>
      <PreviewBanner text={`Local metrics for ${postId ?? 'post'} — Preview only.`} />
      {[
        ['Likes', '42'],
        ['Replies', '9'],
        ['Reposts', '3'],
        ['Saves', '11'],
        ['Profile visits from post', '17'],
      ].map(([label, value]) => (
        <Surface key={label} variant="contained" style={{padding: spacing[4], gap: spacing[1]}}>
          <AppText variant="caption" colour="textSecondary">
            {label}
          </AppText>
          <AppText variant="headline">{value}</AppText>
        </Surface>
      ))}
    </ScreenShell>
  )
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  bannerText: {
    flexShrink: 1,
    lineHeight: 20,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  fab: {
    alignItems: 'center',
    bottom: 24,
    height: 56,
    justifyContent: 'center',
    position: 'absolute',
    right: 20,
    width: 56,
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  glassBadge: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
  },
  row: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
  },
  screen: {
    flex: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    minHeight: 44,
  },
  searchRow: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 44,
  },
  sticker: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flexBasis: '30%',
    justifyContent: 'center',
    minHeight: 72,
  },
  stickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
})
