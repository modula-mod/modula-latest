import {StyleSheet, View} from 'react-native'
import {useRouter} from 'expo-router'

import {AppIcon} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {Avatar} from '@/components/primitives/Avatar'
import type {SocialPost} from '@/domain/social'
import {getProfileRouteForIdentity} from '@/features/profile/navigation/openProfile'
import {relativePostTime} from '@/features/social/posts/types/post'
import {postLayerZ} from '@/features/social/posts/tokens/post-layout'
import {POST_GEOMETRY} from '@/features/social/posts/tokens/post-geometry'
import {useSession} from '@/auth/runtime'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type PostHeaderProps = {
  post: SocialPost
  overlay?: boolean
  opacity?: number
}

export function PostHeader({post, overlay = true, opacity = 1}: PostHeaderProps) {
  const router = useRouter()
  const session = useSession()
  const {colours, spacing} = useThemeTokens()
  const profileRoute = getProfileRouteForIdentity(
    post.author,
    session.status === 'signedIn' ? session.profile.id : '',
  )
  const verified = post.author.identityClaims?.some(claim => claim.status === 'verified')
  const location = post.author.location?.label
  const ink = overlay ? colours.mediaOverlayText : colours.textMain
  const subInk = overlay ? colours.mediaOverlaySecondary : colours.textSub

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.root,
        {
          opacity,
          paddingHorizontal: POST_GEOMETRY.headerInset,
          paddingTop: spacing[3],
          zIndex: postLayerZ('chrome'),
        },
      ]}>
      <AppPressable
        accessibilityLabel={`Open ${post.author.displayName} profile`}
        onPress={() => router.push(profileRoute)}
        style={[styles.identity, {gap: spacing[2]}]}>
        <Avatar
          name={post.author.displayName}
          uri={post.author.avatarUri}
          colour={post.author.coverColour}
          size={40}
        />
        <View style={styles.meta}>
          <View style={styles.nameRow}>
            <AppText variant="label" numberOfLines={1} style={{color: ink}}>
              {post.author.displayName}
            </AppText>
            {verified ? (
              <View style={styles.verified}>
                <AppIcon name="check" colour="#FFFFFF" size={10} />
              </View>
            ) : null}
            <AppText variant="caption" style={{color: subInk}}>
              · {relativePostTime(post.createdAt)}
            </AppText>
          </View>
          {location ? (
            <AppText variant="caption" numberOfLines={1} style={{color: subInk}}>
              📍 {location}
            </AppText>
          ) : null}
        </View>
      </AppPressable>
    </View>
  )
}

const styles = StyleSheet.create({
  identity: {
    alignItems: 'center',
    flexDirection: 'row',
    minWidth: 0,
  },
  meta: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  nameRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    minWidth: 0,
  },
  root: {
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  verified: {
    alignItems: 'center',
    backgroundColor: '#369CAA',
    borderRadius: 999,
    height: 14,
    justifyContent: 'center',
    width: 14,
  },
})
