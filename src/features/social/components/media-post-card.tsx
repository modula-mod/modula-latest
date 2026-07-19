import {Image} from 'expo-image'
import {LinearGradient} from 'expo-linear-gradient'
import {useRouter, type Href} from 'expo-router'
import {useState} from 'react'
import {LayoutChangeEvent, StyleSheet, View} from 'react-native'
import Svg, {Path} from 'react-native-svg'

import {ProgressiveBlurBand} from '@/components/materials/ProgressiveBlurBand'
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
import {useSavePostMutation} from '@/features/feed/data'
import {getProfileRouteForIdentity} from '@/features/profile/navigation/openProfile'
import {useReactionMutation} from '@/features/social/data/useReactionMutation'
import {useSession} from '@/auth/runtime'
import {selectionHaptic} from '@/lib/haptics'
import {StackedAvatars} from '@/platform/ui/avatars'
import type {AvatarFace} from '@/platform/ui/avatars/types'
import {LiquidGlassChrome} from '@/platform/ui/materials/liquid-glass-chrome'
import {MaskedView} from '@/platform/ui/materials/masked-view'
import {ModulaContextMenu} from '@/platform/ui/menus/modula-context-menu'
import {ModulaMenu} from '@/platform/ui/menus/modula-menu'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const CORNER = 40
const SCOOP_W = 188
const SCOOP_H = 58

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

/** Rounded rect with a concave inverted corner scooped from bottom-left. */
function invertedCornerPath(
  width: number,
  height: number,
  corner: number,
  scoopW: number,
  scoopH: number,
): string {
  const r = Math.min(corner, width / 4, height / 4)
  const sw = Math.min(scoopW, width * 0.58)
  const sh = Math.min(scoopH, height * 0.22)
  return [
    `M ${r} 0`,
    `H ${width - r}`,
    `A ${r} ${r} 0 0 1 ${width} ${r}`,
    `V ${height - r}`,
    `A ${r} ${r} 0 0 1 ${width - r} ${height}`,
    `H ${sw}`,
    // Concave scoop into the media — soft S-curve inverted corner.
    `C ${sw * 0.42} ${height}, 0 ${height - sh * 0.42}, 0 ${height - sh}`,
    `V ${r}`,
    `A ${r} ${r} 0 0 1 ${r} 0`,
    'Z',
  ].join(' ')
}

/**
 * Media-forward feed card: inverted-corner hero, progressive blur dissolve,
 * liquid-glass chrome, cutout action row, caption below.
 */
export function MediaPostCard({post}: {post: MediaSocialPost}) {
  const router = useRouter()
  const session = useSession()
  const {colours, spacing} = useThemeTokens()
  const reaction = useReactionMutation()
  const save = useSavePostMutation()
  const [frame, setFrame] = useState({width: 0, height: 0})
  const media = post.media[0]
  const glow = post.glowColour || colours.mediaGlowFallback
  const aspect = media?.aspectRatio ?? 4 / 5
  const profileRoute = getProfileRouteForIdentity(
    post.author,
    session.status === 'signedIn' ? session.profile.id : '',
  )
  const overflowActions = buildPostOverflowActions(post)
  const liked = Boolean(post.liked || post.viewerReaction)
  const audioLabel = media?.title?.trim() || `Original audio · @${post.author.handle}`
  const likedRed = colours.destructive

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
      {id: `${post.id}-liker-b`, name: 'Liked', colour: glow},
      {id: `${post.id}-liker-c`, name: 'Liked', colour: colours.accent},
    )
  }

  const runOverflow = (id: string) => {
    void runPostOverflowAction(id as PostOverflowActionId, post)
  }

  const onLayout = (event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width
    if (width <= 0) return
    const height = width / aspect
    if (Math.abs(width - frame.width) < 0.5 && Math.abs(height - frame.height) < 0.5) {
      return
    }
    setFrame({width, height})
  }

  const path =
    frame.width > 0
      ? invertedCornerPath(frame.width, frame.height, CORNER, SCOOP_W, SCOOP_H)
      : ''

  return (
    <View style={{gap: spacing[3]}}>
      <ModulaContextMenu
        accessibilityLabel={`Post by ${post.author.displayName}`}
        actions={overflowActions}
        onAction={runOverflow}>
        <View onLayout={onLayout} style={styles.frame}>
          <View
            pointerEvents="none"
            style={[
              styles.mediaGlow,
              {
                backgroundColor: glow,
                borderRadius: CORNER,
              },
            ]}
          />

          {frame.width > 0 ? (
            <MaskedView
              style={{width: frame.width, height: frame.height}}
              maskElement={
                <Svg width={frame.width} height={frame.height}>
                  <Path d={path} fill="#FFFFFF" />
                </Svg>
              }>
              <View
                style={[
                  styles.mediaFill,
                  {
                    width: frame.width,
                    height: frame.height,
                    backgroundColor: media?.colour ?? colours.surfaceMuted,
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
                  colors={['rgba(0,0,0,0.4)', 'transparent', 'transparent']}
                  locations={[0, 0.32, 1]}
                  style={StyleSheet.absoluteFill}
                  pointerEvents="none"
                />

                {/* Progressive blur dissolves the bottom edge into the feed. */}
                <ProgressiveBlurBand
                  height={Math.max(72, SCOOP_H + 28)}
                  topHeavy={false}
                  intensity={54}
                  style={styles.bottomBlur}
                />
              </View>
            </MaskedView>
          ) : (
            <View style={[styles.mediaPlaceholder, {aspectRatio: aspect}]} />
          )}

          {/* Top identity + liquid-glass more */}
          <View
            pointerEvents="box-none"
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
                  <View style={[styles.verified, {backgroundColor: colours.accent}]}>
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
                <LiquidGlassChrome interactive fallback="clear" style={styles.moreGlass}>
                  <AppIcon name="more" colour={colours.mediaOverlayIcon} size={18} />
                </LiquidGlassChrome>
              }
            />
          </View>

          {/* Liquid-glass social proof on the remaining bottom-right media. */}
          <View
            pointerEvents="box-none"
            style={[
              styles.proofAnchor,
              {
                right: spacing[3],
                bottom: spacing[3],
              },
            ]}>
            <LiquidGlassChrome interactive fallback="regular" style={styles.proofGlass}>
              <View style={[styles.proofInner, {gap: spacing[2], paddingHorizontal: spacing[2]}]}>
                <StackedAvatars faces={likerFaces} size={22} max={3} overlap={8} />
                <AppText
                  variant="label"
                  style={{color: colours.mediaOverlayText}}
                  numberOfLines={1}>
                  {formatCompact(post.likeCount)} Liked
                </AppText>
              </View>
            </LiquidGlassChrome>
          </View>

          {/* Actions sit in the inverted-corner negative space (canvas, not on media). */}
          <View
            pointerEvents="box-none"
            style={[
              styles.cutoutActions,
              {
                width: SCOOP_W - 8,
                height: SCOOP_H,
                paddingLeft: spacing[1],
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
              style={styles.cutoutHit}>
              <AppIcon name="like" colour={liked ? likedRed : colours.text} size={24} />
            </AppPressable>
            <AppPressable
              accessibilityLabel="Comment on post"
              onPress={() => router.push(`/post/${post.id}` as Href)}
              style={styles.cutoutHit}>
              <AppIcon name="comment" colour={colours.text} size={24} />
            </AppPressable>
            <AppPressable
              accessibilityLabel="Share post"
              onPress={() => void runPostOverflowAction('share', post)}
              style={styles.cutoutHit}>
              <AppIcon name="share" colour={colours.text} size={24} />
            </AppPressable>
            <AppPressable
              accessibilityLabel={post.saved ? 'Unsave post' : 'Save post'}
              accessibilityState={{selected: post.saved}}
              onPress={() => {
                void selectionHaptic()
                save.mutate({postId: post.id, saved: !post.saved})
              }}
              style={styles.cutoutHit}>
              <AppIcon
                name="saved"
                colour={post.saved ? colours.accent : colours.text}
                size={24}
              />
            </AppPressable>
          </View>
        </View>
      </ModulaContextMenu>

      <View style={{gap: spacing[1], paddingHorizontal: spacing[1]}}>
        <AppText variant="caption" colour="textTertiary">
          {relativeTime(post.createdAt)}
        </AppText>
        {post.likeCount > 0 ? (
          <AppText variant="caption" colour="textSecondary" numberOfLines={1}>
            @{post.author.handle} and others liked this post
          </AppText>
        ) : null}
        {post.text?.trim() ? (
          <AppText variant="body" numberOfLines={3}>
            <AppText variant="label">@{post.author.handle} </AppText>
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
  bottomBlur: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  cutoutActions: {
    alignItems: 'center',
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'flex-start',
    left: 0,
    position: 'absolute',
    zIndex: 3,
  },
  cutoutHit: {
    alignItems: 'center',
    height: 48,
    justifyContent: 'center',
    width: 44,
  },
  frame: {
    position: 'relative',
    width: '100%',
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
  mediaFill: {
    overflow: 'hidden',
  },
  mediaGlow: {
    bottom: -8,
    left: 18,
    opacity: 0.16,
    position: 'absolute',
    right: 18,
    top: 18,
  },
  mediaPlaceholder: {
    width: '100%',
  },
  moreGlass: {
    alignItems: 'center',
    borderRadius: 999,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  nameRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    minWidth: 0,
  },
  proofAnchor: {
    position: 'absolute',
    zIndex: 3,
  },
  proofGlass: {
    borderRadius: 999,
    minHeight: 44,
    overflow: 'hidden',
  },
  proofInner: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 44,
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
