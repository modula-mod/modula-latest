import {Image} from 'expo-image'
import {LinearGradient} from 'expo-linear-gradient'
import {useRouter, type Href} from 'expo-router'
import {useEffect, useRef, useState} from 'react'
import {LayoutChangeEvent, StyleSheet, View} from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
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
import {useReduceMotion} from '@/lib/accessibility'
import {lightImpactHaptic, selectionHaptic} from '@/lib/haptics'
import {StackedAvatars} from '@/platform/ui/avatars'
import type {AvatarFace} from '@/platform/ui/avatars/types'
import {
  buildMediaInvertedCornerPath,
  MEDIA_INVERTED_DEFAULTS,
} from '@/features/social/components/inverted-corner-path'
import {LiquidGlassChrome} from '@/platform/ui/materials/liquid-glass-chrome'
import {MaskedView} from '@/platform/ui/materials/masked-view'
import {ModulaContextMenu} from '@/platform/ui/menus/modula-context-menu'
import {ModulaMenu} from '@/platform/ui/menus/modula-menu'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const {cornerRadius: CORNER, trayWidth: TRAY_W, trayHeight: TRAY_H, biteRadii: BITE} =
  MEDIA_INVERTED_DEFAULTS

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

function TrayIcon({
  label,
  selected,
  colour,
  icon,
  onPress,
  onLongPress,
}: {
  label: string
  selected?: boolean
  colour: string
  icon: 'like' | 'comment' | 'share' | 'saved' | 'event'
  onPress: () => void
  onLongPress?: () => void
}) {
  const reduceMotion = useReduceMotion()
  const scale = useSharedValue(1)
  const style = useAnimatedStyle(() => ({transform: [{scale: scale.value}]}))

  return (
    <AppPressable
      accessibilityLabel={label}
      accessibilityState={{selected}}
      onPress={() => {
        if (!reduceMotion) {
          // Reanimated shared value, not React state.
          // eslint-disable-next-line react-hooks/immutability
          scale.value = withSequence(
            withSpring(0.86, {damping: 14, stiffness: 320}),
            withSpring(1, {damping: 12, stiffness: 220}),
          )
        }
        onPress()
      }}
      onLongPress={onLongPress}
      delayLongPress={320}
      style={styles.trayHit}>
      <Animated.View style={style}>
        <AppIcon name={icon} colour={colour} size={25} />
      </Animated.View>
    </AppPressable>
  )
}

/**
 * Media card: corner-inverter BL tray, progressive blur, liquid-glass views,
 * double-tap like, spring tray presses.
 */
export function MediaPostCard({post}: {post: MediaSocialPost}) {
  const router = useRouter()
  const session = useSession()
  const {colours, spacing, scheme} = useThemeTokens()
  const reduceMotion = useReduceMotion()
  const reaction = useReactionMutation()
  const save = useSavePostMutation()
  const [frame, setFrame] = useState({width: 0, height: 0})
  const lastTap = useRef(0)
  const heartScale = useSharedValue(0)
  const heartOpacity = useSharedValue(0)
  const audioPulse = useSharedValue(1)

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
  const caption = post.text?.trim() ?? ''
  const captionLong = caption.length > 96

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

  useEffect(() => {
    if (reduceMotion) {
      audioPulse.value = 1
      return
    }
    audioPulse.value = withSequence(
      withTiming(0.55, {duration: 900}),
      withTiming(1, {duration: 900}),
    )
    const id = setInterval(() => {
      audioPulse.value = withSequence(
        withTiming(0.55, {duration: 900}),
        withTiming(1, {duration: 900}),
      )
    }, 1800)
    return () => clearInterval(id)
  }, [audioPulse, reduceMotion])

  const heartStyle = useAnimatedStyle(() => ({
    opacity: heartOpacity.value,
    transform: [{scale: heartScale.value}],
  }))
  const audioStyle = useAnimatedStyle(() => ({opacity: audioPulse.value}))

  const runOverflow = (id: string) => {
    void runPostOverflowAction(id as PostOverflowActionId, post)
  }

  const toggleLike = (forceLike = false) => {
    void lightImpactHaptic()
    const nextLiked = forceLike ? true : !liked
    reaction.mutate({
      postId: post.id,
      reaction: nextLiked ? 'like' : null,
    })
    if (nextLiked && !reduceMotion) {
      // Reanimated shared values, not React state.
      // eslint-disable-next-line react-hooks/immutability
      heartScale.value = 0.4
      // eslint-disable-next-line react-hooks/immutability
      heartOpacity.value = 1
      heartScale.value = withSpring(1.12, {damping: 10, stiffness: 200})
      heartOpacity.value = withTiming(0, {duration: 520})
    }
  }

  const onMediaPress = () => {
    const now = Date.now()
    if (now - lastTap.current < 280) {
      toggleLike(true)
      lastTap.current = 0
      return
    }
    lastTap.current = now
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
      ? buildMediaInvertedCornerPath(frame.width, frame.height, MEDIA_INVERTED_DEFAULTS)
      : ''

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
                <View
                  style={{
                    width: frame.width,
                    height: frame.height,
                    backgroundColor: 'transparent',
                  }}>
                  <Svg width={frame.width} height={frame.height}>
                    <Path d={path} fill="#FFFFFF" />
                  </Svg>
                </View>
              }>
              <AppPressable
                accessibilityLabel="Double tap to like"
                onPress={onMediaPress}
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
                    start={{x: 0.12, y: 0}}
                    end={{x: 0.9, y: 1}}
                    style={StyleSheet.absoluteFill}
                  />
                )}

                <LinearGradient
                  colors={['rgba(0,0,0,0.48)', 'transparent', 'transparent']}
                  locations={[0, 0.26, 1]}
                  style={StyleSheet.absoluteFill}
                  pointerEvents="none"
                />

                <ProgressiveBlurBand
                  height={TRAY_H + 48}
                  topHeavy={false}
                  intensity={72}
                  style={styles.bottomBlur}
                />

                <Animated.View pointerEvents="none" style={[styles.heartBurst, heartStyle]}>
                  <AppIcon name="like" colour={likedRed} size={72} />
                </Animated.View>
              </AppPressable>
            </MaskedView>
          ) : (
            <View style={[styles.mediaPlaceholder, {aspectRatio: aspect}]} />
          )}

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
                    size={38}
                  />
                </View>
              </LinearGradient>
              <View style={styles.identityText}>
                <View style={styles.nameRow}>
                  <AppText
                    variant="label"
                    style={[styles.overlayText, {color: colours.mediaOverlayText}]}
                    numberOfLines={1}>
                    {post.author.displayName}
                  </AppText>
                  <View style={styles.verified}>
                    <AppIcon name="check" colour="#FFFFFF" size={10} />
                  </View>
                </View>
                <View style={[styles.audioRow, {gap: 5}]}>
                  <Animated.View style={audioStyle}>
                    <AppIcon name="play" colour={colours.mediaOverlaySecondary} size={12} />
                  </Animated.View>
                  <AppText
                    variant="caption"
                    style={[styles.overlayText, {color: colours.mediaOverlaySecondary, flex: 1}]}
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

          <View
            pointerEvents="box-none"
            style={[
              styles.proofAnchor,
              {right: spacing[3], bottom: spacing[3] + 8},
            ]}>
            <LiquidGlassChrome interactive fallback="regular" style={styles.proofGlass}>
              <View style={[styles.proofInner, {gap: spacing[2], paddingHorizontal: spacing[3]}]}>
                <StackedAvatars faces={likerFaces} size={24} max={3} overlap={9} />
                <AppText
                  variant="label"
                  style={{color: colours.mediaOverlayText}}
                  numberOfLines={1}>
                  {viewsLabel} views
                </AppText>
              </View>
            </LiquidGlassChrome>
          </View>

          <View
            pointerEvents="box-none"
            style={[
              styles.tray,
              {
                width: TRAY_W - BITE[0] + 4,
                height: TRAY_H,
                paddingLeft: spacing[2],
                gap: 2,
              },
            ]}>
            <TrayIcon
              label={liked ? 'Unlike' : 'Like'}
              selected={liked}
              icon="like"
              colour={liked ? likedRed : colours.text}
              onPress={() => toggleLike()}
              onLongPress={() => {
                void selectionHaptic()
                reaction.mutate({postId: post.id, reaction: 'love'})
              }}
            />
            <TrayIcon
              label="Comment on post"
              icon="comment"
              colour={colours.text}
              onPress={() => router.push(`/post/${post.id}` as Href)}
            />
            <TrayIcon
              label="Share post"
              icon="share"
              colour={colours.text}
              onPress={() => void runPostOverflowAction('share', post)}
            />
            <TrayIcon
              label={post.saved ? 'Unsave post' : 'Save for later'}
              selected={post.saved}
              icon={post.saved ? 'saved' : 'event'}
              colour={post.saved ? colours.accent : colours.text}
              onPress={() => {
                void selectionHaptic()
                save.mutate({postId: post.id, saved: !post.saved})
              }}
            />
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
        {caption ? (
          <AppPressable
            accessibilityLabel="Open post"
            onPress={() => router.push(`/post/${post.id}` as Href)}>
            <AppText variant="body" numberOfLines={2}>
              <AppText variant="label">@{post.author.handle} </AppText>
              {caption}
              {captionLong ? (
                <AppText variant="body" colour="textSecondary">
                  {' '}
                  more
                </AppText>
              ) : null}
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
    padding: 2.5,
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
  heartBurst: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  identity: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    minWidth: 0,
  },
  identityText: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  mediaGlow: {
    bottom: -8,
    left: 14,
    opacity: 0.18,
    position: 'absolute',
    right: 14,
    top: 14,
  },
  mediaPlaceholder: {
    width: '100%',
  },
  moreButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 999,
    elevation: 4,
    height: 34,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 3},
    shadowOpacity: 0.14,
    shadowRadius: 8,
    width: 34,
  },
  nameRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    minWidth: 0,
  },
  overlayText: {
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 3,
  },
  proofAnchor: {
    position: 'absolute',
    zIndex: 4,
  },
  proofGlass: {
    borderRadius: 999,
    minHeight: 46,
    overflow: 'hidden',
  },
  proofInner: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 46,
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
    height: 54,
    justifyContent: 'center',
    width: 44,
  },
  verified: {
    alignItems: 'center',
    backgroundColor: '#7B5CFF',
    borderRadius: 999,
    height: 15,
    justifyContent: 'center',
    width: 15,
  },
})
