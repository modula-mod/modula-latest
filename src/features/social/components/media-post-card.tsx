import {Image} from 'expo-image'
import {LinearGradient} from 'expo-linear-gradient'
import {useRouter, type Href} from 'expo-router'
import {StyleSheet, View} from 'react-native'

import {AppIcon} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {Avatar} from '@/components/primitives/Avatar'
import type {MediaSocialPost} from '@/domain/social'
import {
  buildPostOverflowActions,
  runPostOverflowAction,
  type PostOverflowActionId,
} from '@/features/feed/postActions'
import {getProfileRouteForIdentity} from '@/features/profile/navigation/openProfile'
import {useReactionMutation} from '@/features/social/data/useReactionMutation'
import {useSession} from '@/auth/runtime'
import {selectionHaptic} from '@/lib/haptics'
import {StackedAvatars} from '@/platform/ui/avatars'
import type {AvatarFace} from '@/platform/ui/avatars/types'
import {ModulaContextMenu} from '@/platform/ui/menus/modula-context-menu'
import {ModulaMenu} from '@/platform/ui/menus/modula-menu'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

function relativeTime(iso: string): string {
  const minutes = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60_000))
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  return hours < 24 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`
}

function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10_000 ? 0 : 1)}k`
  return String(value)
}

/**
 * Media-forward feed card: large rounded media, overlay identity,
 * floating action + social-proof pills, caption below.
 */
export function MediaPostCard({post}: {post: MediaSocialPost}) {
  const router = useRouter()
  const session = useSession()
  const {colours, radius, spacing} = useThemeTokens()
  const reaction = useReactionMutation()
  const media = post.media[0]
  const glow = post.glowColour || colours.mediaGlowFallback
  const profileRoute = getProfileRouteForIdentity(
    post.author,
    session.status === 'signedIn' ? session.profile.id : '',
  )
  const overflowActions = buildPostOverflowActions(post)
  const liked = Boolean(post.liked || post.viewerReaction)
  const audioLabel = media?.title?.trim() || `Original audio · @${post.author.handle}`

  const likerFaces: AvatarFace[] = [
    {
      id: post.author.id,
      name: post.author.displayName,
      uri: post.author.avatarUri,
      colour: post.author.coverColour,
    },
  ]
  if (post.likeCount > 1) {
    likerFaces.push(
      {
        id: `${post.id}-liker-b`,
        name: 'Liked',
        colour: glow,
      },
      {
        id: `${post.id}-liker-c`,
        name: 'Liked',
        colour: colours.accent,
      },
    )
  }

  const runOverflow = (id: string) => {
    void runPostOverflowAction(id as PostOverflowActionId, post)
  }

  const pillBg = colours.textInverse
  // Dark ink on light floating pills — intentional media chrome, both schemes.
  const ink = '#141418'
  const likedRed = colours.destructive

  return (
    <View style={{gap: spacing[3]}}>
      <ModulaContextMenu
        accessibilityLabel={`Post by ${post.author.displayName}`}
        actions={overflowActions}
        onAction={runOverflow}>
        <View>
          <View
            pointerEvents="none"
            style={[
              styles.mediaGlow,
              {
                backgroundColor: glow,
                borderRadius: radius.xxlarge,
              },
            ]}
          />
          <View
            style={[
              styles.media,
              {
                aspectRatio: media?.aspectRatio ?? 4 / 5,
                backgroundColor: media?.colour ?? colours.surfaceMuted,
                borderRadius: radius.xxlarge,
                shadowColor: colours.mediaOverlayShadow,
              },
            ]}>
            {media?.url && !media.url.startsWith('local://') ? (
              <Image
                source={{uri: media.url}}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
              />
            ) : (
              <LinearGradient
                colors={[glow, media?.colour ?? colours.surfaceMuted, colours.surface3]}
                locations={[0, 0.55, 1]}
                start={{x: 0.1, y: 0}}
                end={{x: 0.9, y: 1}}
                style={StyleSheet.absoluteFill}
              />
            )}

            <LinearGradient
              colors={['rgba(0,0,0,0.45)', 'transparent', 'transparent', 'rgba(0,0,0,0.35)']}
              locations={[0, 0.28, 0.62, 1]}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />

            {/* Top identity overlay */}
            <View
              style={[
                styles.topRow,
                {
                  paddingHorizontal: spacing[3],
                  paddingTop: spacing[3],
                  gap: spacing[2],
                },
              ]}>
              <AppPressable
                accessibilityLabel={`Open ${post.author.displayName} profile`}
                onPress={() => router.push(profileRoute)}
                style={[styles.identity, {gap: spacing[2]}]}>
                <LinearGradient
                  colors={[colours.accent, '#7B5CFF', colours.warning]}
                  start={{x: 0, y: 0}}
                  end={{x: 1, y: 1}}
                  style={styles.avatarRing}>
                  <View style={styles.avatarInner}>
                    <Avatar
                      name={post.author.displayName}
                      uri={post.author.avatarUri}
                      colour={post.author.coverColour}
                      size={36}
                    />
                  </View>
                </LinearGradient>
                <View style={styles.identityText}>
                  <View style={styles.nameRow}>
                    <AppText
                      variant="label"
                      style={{color: colours.mediaOverlayText}}
                      numberOfLines={1}>
                      {post.author.displayName}
                    </AppText>
                    <View
                      style={[
                        styles.verified,
                        {backgroundColor: colours.accent},
                      ]}>
                      <AppIcon name="check" colour={colours.accentForeground} size={10} />
                    </View>
                  </View>
                  <View style={[styles.audioRow, {gap: 4}]}>
                    <AppIcon name="play" colour={colours.mediaOverlaySecondary} size={12} />
                    <AppText
                      variant="caption"
                      style={{color: colours.mediaOverlaySecondary, flex: 1}}
                      numberOfLines={1}>
                      {audioLabel}
                    </AppText>
                  </View>
                </View>
              </AppPressable>

              <ModulaMenu
                accessibilityLabel="Open post options"
                title="Post options"
                actions={overflowActions}
                onAction={runOverflow}
                trigger={
                  <View
                    style={[
                      styles.moreButton,
                      {
                        backgroundColor: pillBg,
                        shadowColor: colours.mediaOverlayShadow,
                      },
                    ]}>
                    <AppIcon name="more" colour={ink} size={18} />
                  </View>
                }
              />
            </View>

            {/* Floating liker sparks */}
            {post.likeCount > 0 ? (
              <View
                pointerEvents="none"
                style={[styles.floatLikes, {left: spacing[4], bottom: 72}]}>
                {likerFaces.slice(0, 2).map((face, index) => (
                  <View
                    key={face.id}
                    style={[
                      styles.floatFace,
                      {
                        marginLeft: index === 0 ? 0 : 10,
                        transform: [{translateY: index === 0 ? 0 : -14}],
                      },
                    ]}>
                    <Avatar
                      name={face.name}
                      uri={face.uri}
                      colour={face.colour}
                      size={28}
                    />
                    <View
                      style={[
                        styles.floatHeart,
                        {backgroundColor: likedRed, borderColor: pillBg},
                      ]}>
                      <AppIcon name="like" colour={pillBg} size={8} />
                    </View>
                  </View>
                ))}
              </View>
            ) : null}

            {/* Bottom floating pills */}
            <View
              style={[
                styles.bottomPills,
                {
                  paddingHorizontal: spacing[3],
                  paddingBottom: spacing[3],
                  gap: spacing[2],
                },
              ]}>
              <View
                style={[
                  styles.actionPill,
                  {
                    backgroundColor: pillBg,
                    shadowColor: colours.mediaOverlayShadow,
                    gap: spacing[1],
                    paddingHorizontal: spacing[2],
                  },
                ]}>
                <AppPressable
                  accessibilityLabel={liked ? 'Unlike' : 'Like'}
                  accessibilityState={{selected: liked}}
                  onPress={() => {
                    void selectionHaptic()
                    reaction.mutate({
                      postId: post.id,
                      reaction: liked ? null : 'like',
                    })
                  }}
                  onLongPress={() => {
                    void selectionHaptic()
                    reaction.mutate({postId: post.id, reaction: 'love'})
                  }}
                  style={styles.pillHit}>
                  <AppIcon
                    name="like"
                    colour={liked ? likedRed : ink}
                    size={22}
                  />
                </AppPressable>
                <AppPressable
                  accessibilityLabel="Comment on post"
                  onPress={() => router.push(`/post/${post.id}` as Href)}
                  style={styles.pillHit}>
                  <AppIcon name="comment" colour={ink} size={22} />
                </AppPressable>
                <AppPressable
                  accessibilityLabel="Share post"
                  onPress={() => void runPostOverflowAction('share', post)}
                  style={styles.pillHit}>
                  <AppIcon name="share" colour={ink} size={22} />
                </AppPressable>
                <AppPressable
                  accessibilityLabel="React to post"
                  onPress={() => {
                    void selectionHaptic()
                    reaction.mutate({
                      postId: post.id,
                      reaction: post.viewerReaction === 'funny' ? null : 'funny',
                    })
                  }}
                  style={styles.pillHit}>
                  <AppIcon name="gif" colour={ink} size={22} />
                </AppPressable>
              </View>

              <View
                style={[
                  styles.proofPill,
                  {
                    backgroundColor: pillBg,
                    shadowColor: colours.mediaOverlayShadow,
                    gap: spacing[2],
                    paddingHorizontal: spacing[2],
                  },
                ]}>
                <StackedAvatars faces={likerFaces} size={22} max={3} overlap={8} />
                <AppText variant="label" style={{color: ink}} numberOfLines={1}>
                  {formatCompact(post.likeCount)} Liked
                </AppText>
              </View>
            </View>
          </View>
        </View>
      </ModulaContextMenu>

      <View style={{gap: spacing[1], paddingHorizontal: spacing[1]}}>
        <AppText variant="caption" colour="textTertiary">
          {relativeTime(post.createdAt)}
        </AppText>
        {post.text?.trim() ? (
          <AppText variant="body" numberOfLines={3}>
            <AppText variant="label">{post.author.displayName} </AppText>
            {post.text}
          </AppText>
        ) : null}
        {post.replyCount > 0 ? (
          <AppPressable
            accessibilityLabel="View comments"
            onPress={() => router.push(`/post/${post.id}` as Href)}>
            <AppText variant="caption" colour="textSecondary">
              View {post.replyCount} comment{post.replyCount === 1 ? '' : 's'}
            </AppText>
          </AppPressable>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  actionPill: {
    alignItems: 'center',
    borderRadius: 999,
    flexDirection: 'row',
    minHeight: 48,
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 6,
  },
  audioRow: {
    alignItems: 'center',
    flexDirection: 'row',
    minWidth: 0,
  },
  avatarInner: {
    backgroundColor: '#000',
    borderRadius: 999,
    padding: 2,
  },
  avatarRing: {
    borderRadius: 999,
    padding: 2,
  },
  bottomPills: {
    alignItems: 'flex-end',
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    left: 0,
    position: 'absolute',
    right: 0,
  },
  floatFace: {
    position: 'relative',
  },
  floatHeart: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1.5,
    height: 14,
    justifyContent: 'center',
    position: 'absolute',
    right: -2,
    top: -2,
    width: 14,
  },
  floatLikes: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    position: 'absolute',
  },
  identity: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    minWidth: 0,
  },
  identityText: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  media: {
    justifyContent: 'flex-end',
    overflow: 'hidden',
    shadowOffset: {width: 0, height: 12},
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 8,
  },
  mediaGlow: {
    bottom: -10,
    left: 16,
    opacity: 0.18,
    position: 'absolute',
    right: 16,
    top: 16,
  },
  moreButton: {
    alignItems: 'center',
    borderRadius: 999,
    height: 36,
    justifyContent: 'center',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 4,
    width: 36,
  },
  nameRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    minWidth: 0,
  },
  pillHit: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 40,
  },
  proofPill: {
    alignItems: 'center',
    borderRadius: 999,
    flexDirection: 'row',
    maxWidth: '46%',
    minHeight: 48,
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 6,
  },
  topRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 2,
  },
  verified: {
    alignItems: 'center',
    borderRadius: 999,
    height: 14,
    justifyContent: 'center',
    width: 14,
  },
})
