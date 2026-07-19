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

/** Outer media corner radius. */
const CORNER = 36
/** White action-tray width (bottom-left bite). */
const TRAY_W = 196
/** White action-tray height. */
const TRAY_H = 62
/** Concave fillet where media curves into the tray. */
const FILLET = 52

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
 * Rounded media with a crisp concave bite at bottom-left.
 * The missing corner is canvas — that white/dark tray holds the actions.
 */
export function buildInvertedCornerPath(
  width: number,
  height: number,
  corner = CORNER,
  trayW = TRAY_W,
  trayH = TRAY_H,
  fillet = FILLET,
): string {
  const r = Math.min(corner, width / 5, height / 5)
  const tw = Math.min(Math.max(trayW, fillet + 8), width * 0.62)
  const th = Math.min(Math.max(trayH, fillet * 0.7), height * 0.2)
  const f = Math.min(fillet, tw * 0.85, th * 1.15)

  // Clockwise media outline. Bottom edge stops at `tw`, then a concave
  // cubic scoops up to the left edge at `height - th` — clear tray below.
  return [
    `M ${r} 0`,
    `H ${width - r}`,
    `A ${r} ${r} 0 0 1 ${width} ${r}`,
    `V ${height - r}`,
    `A ${r} ${r} 0 0 1 ${width - r} ${height}`,
    `H ${tw}`,
    `C ${tw} ${height - f * 0.92}, ${f * 0.92} ${height - th}, 0 ${height - th}`,
    `V ${r}`,
    `A ${r} ${r} 0 0 1 ${r} 0`,
    'Z',
  ].join(' ')
}

/**
 * Media card matching the inverted-corner / liquid-glass reference:
 * scooped white tray + cutout actions, progressive blur on media only,
 * glass proof pill on the remaining bottom-right.
 */
export function MediaPostCard({post}: {post: MediaSocialPost}) {
  const router = useRouter()
  const session = useSession()
  const {colours, spacing, scheme} = useThemeTokens()
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
  const moreInk = scheme === 'dark' ? '#141418' : colours.text

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
      ? buildInvertedCornerPath(frame.width, frame.height)
      : ''

  // Preview views figure for the glass pill (no views field on posts yet).
  const viewsLabel = formatCompact(Math.max(post.likeCount * 700, post.likeCount))

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
              {backgroundColor: glow, borderRadius: CORNER},
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
                style={{
                  width: frame.width,
                  height: frame.height,
                  backgroundColor: media?.colour ?? colours.surfaceMuted,
                }}>
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
                  colors={['rgba(0,0,0,0.42)', 'transparent']}
                  locations={[0, 0.3]}
                  style={StyleSheet.absoluteFill}
                  pointerEvents="none"
                />

                {/* Blur follows the masked scoop — dissolves media into the feed. */}
                <ProgressiveBlurBand
                  height={TRAY_H + 36}
                  topHeavy={false}
                  intensity={62}
                  style={styles.bottomBlur}
                />
              </View>
            </MaskedView>
          ) : (
            <View style={[styles.mediaPlaceholder, {aspectRatio: aspect}]} />
          )}

          {/* Header overlay on media */}
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
                  <View style={[styles.verified, {backgroundColor: '#7B5CFF'}]}>
                    <AppIcon name="check" colour="#FFFFFF" size={10} />
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
                <View style={styles.moreButton}>
                  <AppIcon name="more" colour={moreInk} size={18} />
                </View>
              }
            />
          </View>

          {/* Glass proof pill — on remaining bottom-right media, not in the tray. */}
          <View
            pointerEvents="box-none"
            style={[
              styles.proofAnchor,
              {
                right: spacing[3],
                bottom: spacing[3] + 4,
              },
            ]}>
            <LiquidGlassChrome interactive fallback="regular" style={styles.proofGlass}>
              <View style={[styles.proofInner, {gap: spacing[2], paddingHorizontal: spacing[3]}]}>
                <StackedAvatars faces={likerFaces} size={22} max={3} overlap={8} />
                <AppText
                  variant="label"
                  style={{color: colours.mediaOverlayText}}
                  numberOfLines={1}>
                  {viewsLabel} views
                </AppText>
              </View>
            </LiquidGlassChrome>
          </View>

          {/*
            Action tray: sits in the scooped canvas bite (sibling of MaskedView).
            Not on the media / blur — matches the white notch in the reference.
          */}
          <View
            pointerEvents="box-none"
            style={[
              styles.tray,
              {
                width: TRAY_W - 6,
                height: TRAY_H,
                paddingLeft: spacing[2],
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
              style={styles.trayHit}>
              <AppIcon name="like" colour={liked ? likedRed : colours.text} size={26} />
            </AppPressable>
            <AppPressable
              accessibilityLabel="Comment on post"
              onPress={() => router.push(`/post/${post.id}` as Href)}
              style={styles.trayHit}>
              <AppIcon name="comment" colour={colours.text} size={26} />
            </AppPressable>
            <AppPressable
              accessibilityLabel="Share post"
              onPress={() => void runPostOverflowAction('share', post)}
              style={styles.trayHit}>
              <AppIcon name="share" colour={colours.text} size={26} />
            </AppPressable>
            <AppPressable
              accessibilityLabel={post.saved ? 'Unsave post' : 'Save for later'}
              accessibilityState={{selected: post.saved}}
              onPress={() => {
                void selectionHaptic()
                save.mutate({postId: post.id, saved: !post.saved})
              }}
              style={styles.trayHit}>
              <AppIcon
                name={post.saved ? 'saved' : 'event'}
                colour={post.saved ? colours.accent : colours.text}
                size={26}
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
              more
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
  frame: {
    overflow: 'visible',
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
  mediaGlow: {
    bottom: -6,
    left: 16,
    opacity: 0.14,
    position: 'absolute',
    right: 16,
    top: 16,
  },
  mediaPlaceholder: {
    width: '100%',
  },
  moreButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 999,
    height: 34,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
    width: 34,
  },
  nameRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    minWidth: 0,
  },
  proofAnchor: {
    position: 'absolute',
    zIndex: 4,
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
  tray: {
    alignItems: 'center',
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'flex-start',
    left: 0,
    position: 'absolute',
    zIndex: 5,
  },
  trayHit: {
    alignItems: 'center',
    height: 52,
    justifyContent: 'center',
    width: 46,
  },
  verified: {
    alignItems: 'center',
    borderRadius: 999,
    height: 14,
    justifyContent: 'center',
    width: 14,
  },
})
