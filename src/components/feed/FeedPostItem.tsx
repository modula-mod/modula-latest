import {Image} from 'expo-image'
import {useRouter, type Href} from 'expo-router'
import {Alert, StyleSheet, View} from 'react-native'

import {ProtectedActionPrompt} from '@/auth/components/ProtectedActionPrompt'
import {useCapability, useProtectedPrompt, useSession} from '@/auth/runtime'
import {AppIcon, type AppIconName} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {Avatar} from '@/components/primitives/Avatar'
import {Divider} from '@/components/primitives/Divider'
import {Surface} from '@/components/primitives/Surface'
import {PendingMutationBadge} from '@/components/data/PendingMutationBadge'
import {useLikePostMutation, useRepostMutation, useSavePostMutation} from '@/features/feed/data'
import {
  buildPostOverflowActions,
  runPostOverflowAction,
  type PostOverflowActionId,
} from '@/features/feed/postActions'
import {getProfileRouteForIdentity} from '@/features/profile/navigation/openProfile'
import {selectionHaptic} from '@/lib/haptics'
import {ModulaContextMenu} from '@/platform/ui/menus/modula-context-menu'
import {ModulaMenu} from '@/platform/ui/menus/modula-menu'
import {useAppServices} from '@/runtime'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'
import type {SocialPost} from '@/domain/social'

type FeedPostItemProps = {
  post: SocialPost
}

function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.max(1, Math.round(diffMs / 60000))
  if (mins < 60) return `${mins}m`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.round(hours / 24)}d`
}

function marketplaceIdForModuleName(name: string): string {
  const normalized = name.trim().toLowerCase()
  if (normalized.includes('vault')) return 'module-vault-notes'
  if (normalized.includes('task')) return 'module-tasks'
  if (normalized.includes('crm')) return 'module-crm'
  if (normalized.includes('health')) return 'module-health-agent'
  if (normalized.includes('automation')) return 'module-automations'
  if (normalized.includes('translate')) return 'module-translate-lite'
  if (normalized.includes('insight')) return 'module-insights'
  return 'module-vault-notes'
}

export function FeedPostItem({post}: FeedPostItemProps) {
  const router = useRouter()
  const {colours, spacing} = useThemeTokens()
  const session = useSession()
  const {moderationRepository} = useAppServices()
  const ownerProfileId = session.status === 'signedIn' ? session.profile.id : ''
  const profileRoute = getProfileRouteForIdentity(post.author, ownerProfileId)
  const isOwner = Boolean(ownerProfileId) && post.author.id === ownerProfileId
  const overflowActions = buildPostOverflowActions(post, {isOwner})
  const runOverflow = (id: string) => {
    void runPostOverflowAction(id as PostOverflowActionId, post, {moderationRepository})
  }

  return (
    <View>
      <ModulaContextMenu
        accessibilityLabel={`Post by ${post.author.displayName}`}
        actions={overflowActions}
        onAction={runOverflow}>
        <View style={[styles.row, {gap: spacing[3], padding: spacing[4]}]}>
          <AppPressable
            accessibilityLabel={`Open ${post.author.displayName} profile`}
            onPress={() => router.push(profileRoute)}
            style={styles.authorAvatar}>
            <Avatar
              name={post.author.displayName}
              uri={post.author.avatarUri}
              colour={post.author.coverColour}
              size={42}
            />
          </AppPressable>
          <View style={styles.body}>
            <View style={styles.meta}>
              <View style={styles.metaText}>
                <AppPressable
                  accessibilityLabel={`Open ${post.author.displayName} profile`}
                  onPress={() => router.push(profileRoute)}
                  style={styles.authorTextButton}>
                  <AppText variant="label" numberOfLines={1}>
                    {post.author.displayName}
                  </AppText>
                </AppPressable>
                <AppPressable
                  accessibilityLabel={`Open ${post.author.handle} profile`}
                  onPress={() => router.push(profileRoute)}
                  style={styles.authorTextButton}>
                  <AppText variant="caption" colour="textSecondary" numberOfLines={1}>
                    @{post.author.handle} · {formatRelative(post.createdAt)}
                  </AppText>
                </AppPressable>
              </View>
              <ModulaMenu
                accessibilityLabel="Open post actions"
                title="Post options"
                actions={overflowActions}
                onAction={runOverflow}
                trigger={
                  <View style={styles.moreButton}>
                    <AppIcon name="more" colour={colours.textTertiary} size={20} />
                  </View>
                }
              />
            </View>
            <PostBody post={post} />
            {post.optimisticState === 'pending' ? (
              <View style={{marginTop: spacing[2]}}>
                <PendingMutationBadge label="Posting" />
              </View>
            ) : null}
            {post.optimisticState === 'failed' ? (
              <View style={{marginTop: spacing[2]}}>
                <PendingMutationBadge label="Failed" />
              </View>
            ) : null}
            <PostActions
              post={post}
              onReply={() => router.push(`/post/${post.id}` as Href)}
            />
          </View>
        </View>
      </ModulaContextMenu>
      <Divider />
    </View>
  )
}

function PostBody({post}: {post: SocialPost}) {
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()

  if (post.kind === 'media') {
    const media = post.media[0]
    return (
      <View style={{gap: spacing[3], marginTop: spacing[2]}}>
        {post.text ? <AppText variant="body">{post.text}</AppText> : null}
        <View>
          <View
            pointerEvents="none"
            style={[
              styles.mediaGlow,
              {
                backgroundColor: post.glowColour,
                borderRadius: radius.xlarge,
              },
            ]}
          />
          <View
            style={[
              styles.media,
              {
                aspectRatio: media?.aspectRatio ?? 4 / 5,
                backgroundColor: media?.colour ?? colours.surfaceMuted,
                borderRadius: radius.large,
              },
            ]}>
            {media?.url && !media.url.startsWith('local://') ? (
              <Image
                source={{uri: 'url' in media ? media.url : undefined}}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
              />
            ) : (
              <View style={styles.mediaLabel}>
                <AppText variant="headline" style={{color: colours.accentForeground}}>
                  {media?.title ?? 'Modula media'}
                </AppText>
              </View>
            )}
          </View>
        </View>
      </View>
    )
  }

  if (post.kind === 'link') {
    return (
      <View style={{gap: spacing[3], marginTop: spacing[2]}}>
        {post.text ? <AppText variant="body">{post.text}</AppText> : null}
        <AppPressable
          accessibilityLabel={`Open link preview ${post.link.title}`}
          onPress={() => Alert.alert('Local link preview', post.link.title)}>
          <Surface
            variant="contained"
            style={[styles.linkPreview, {padding: spacing[3], gap: spacing[1]}]}>
            <AppText variant="caption" colour="textSecondary">
              {post.link.domain}
            </AppText>
            <AppText variant="headline">{post.link.title}</AppText>
            <AppText variant="caption" colour="textSecondary">
              {post.link.description}
            </AppText>
          </Surface>
        </AppPressable>
      </View>
    )
  }

  if (post.kind === 'module') {
    return (
      <View style={{gap: spacing[3], marginTop: spacing[2]}}>
        {post.text ? <AppText variant="body">{post.text}</AppText> : null}
        <Surface
          variant="contained"
          style={[styles.modulePost, {padding: spacing[3], gap: spacing[3]}]}>
          <View style={styles.moduleIcon}>
            <AppIcon name="modules" colour={colours.accent} size={24} />
          </View>
          <View style={styles.moduleBody}>
            <AppText variant="caption" colour="accent">
              Module surface
            </AppText>
            <AppText variant="headline">{post.module.name}</AppText>
            <AppText variant="caption" colour="textSecondary">
              {post.module.status}
            </AppText>
          </View>
          <AppPressable
            accessibilityLabel={post.module.actionLabel}
            onPress={() =>
              router.push(
                `/marketplace/${marketplaceIdForModuleName(post.module.name)}` as Href,
              )
            }
            style={[
              styles.moduleAction,
              {backgroundColor: colours.accentSubtle, borderRadius: radius.round},
            ]}>
            <AppText variant="label" style={{color: colours.accent}}>
              {post.module.actionLabel}
            </AppText>
          </AppPressable>
        </Surface>
      </View>
    )
  }

  return (
    <AppText variant="body" style={{marginTop: spacing[2]}}>
      {post.text}
    </AppText>
  )
}

function PostActions({post, onReply}: {post: SocialPost; onReply: () => void}) {
  const canEngage = useCapability('post:engage')
  const prompt = useProtectedPrompt()
  const likeMutation = useLikePostMutation()
  const saveMutation = useSavePostMutation()
  const repostMutation = useRepostMutation()
  const {moderationRepository} = useAppServices()
  const {colours} = useThemeTokens()

  const protectedRun = (action: () => void) => {
    if (!canEngage) {
      prompt.show()
      return
    }
    action()
  }

  const actions: {
    label: string
    icon: AppIconName
    count?: number
    selected?: boolean
    onPress: () => void
  }[] = [
    {
      label: 'Reply',
      icon: 'comment',
      count: post.replyCount,
      onPress: onReply,
    },
    {
      label: 'Repost',
      icon: 'repost',
      count: post.repostCount,
      selected: post.reposted,
      onPress: () => {
        void selectionHaptic()
        protectedRun(() =>
          repostMutation.mutate({postId: post.id, reposted: !post.reposted}),
        )
      },
    },
    {
      label: 'Like',
      icon: 'like',
      count: post.likeCount,
      selected: post.liked,
      onPress: () => {
        void selectionHaptic()
        protectedRun(() =>
          likeMutation.mutate({postId: post.id, liked: !post.liked}),
        )
      },
    },
    {
      label: 'Share',
      icon: 'share',
      onPress: () => void runPostOverflowAction('share', post, {moderationRepository}),
    },
    {
      label: 'Save',
      icon: 'bookmark',
      selected: post.saved,
      onPress: () => {
        void selectionHaptic()
        protectedRun(() =>
          saveMutation.mutate({postId: post.id, saved: !post.saved}),
        )
      },
    },
  ]

  return (
    <>
      <View style={styles.actions}>
        {actions.map(action => (
          <AppPressable
            key={action.label}
            accessibilityLabel={action.label}
            accessibilityState={{selected: action.selected}}
            onPress={action.onPress}
            style={styles.actionButton}>
            <AppIcon
              name={action.icon}
              colour={action.selected ? colours.accent : colours.textSecondary}
              size={20}
            />
            {typeof action.count === 'number' ? (
              <AppText
                variant="caption"
                style={{
                  color: action.selected ? colours.accent : colours.textSecondary,
                }}>
                {action.count}
              </AppText>
            ) : null}
          </AppPressable>
        ))}
      </View>
      <ProtectedActionPrompt
        visible={prompt.visible}
        onClose={prompt.hide}
        description="Sign in to like, save, repost, or follow in this local Modula build."
      />
    </>
  )
}

const styles = StyleSheet.create({
  actionButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    minHeight: 44,
    minWidth: 44,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  authorAvatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  authorTextButton: {
    justifyContent: 'center',
    minHeight: 22,
    minWidth: 0,
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  linkPreview: {
    overflow: 'hidden',
  },
  media: {
    overflow: 'hidden',
  },
  mediaGlow: {
    bottom: -8,
    left: 12,
    opacity: 0.14,
    position: 'absolute',
    right: 12,
    top: 12,
  },
  mediaLabel: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 18,
  },
  meta: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  metaText: {
    flex: 1,
    minWidth: 0,
  },
  moduleAction: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 38,
    paddingHorizontal: 12,
  },
  moduleBody: {
    flex: 1,
    minWidth: 0,
  },
  moduleIcon: {
    alignItems: 'center',
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  modulePost: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  moreButton: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    minWidth: 44,
  },
  row: {
    flexDirection: 'row',
  },
})
