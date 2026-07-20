import {StyleSheet, View} from 'react-native'
import {useRouter} from 'expo-router'

import {AppIcon} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {Avatar} from '@/components/primitives/Avatar'
import type {SocialPost} from '@/domain/social'
import {getProfileRouteForIdentity} from '@/features/profile/navigation/openProfile'
import {useSession} from '@/auth/runtime'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type PostHeaderProps = {post: SocialPost; onMore?: () => void}

function relativeTime(iso: string): string {
  const minutes = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60_000))
  if (minutes < 60) return `${minutes}m`
  const hours = Math.round(minutes / 60)
  return hours < 24 ? `${hours}h` : `${Math.round(hours / 24)}d`
}

export function PostHeader({post, onMore}: PostHeaderProps) {
  const router = useRouter()
  const session = useSession()
  const {colours} = useThemeTokens()
  const profileRoute = getProfileRouteForIdentity(
    post.author,
    session.status === 'signedIn' ? session.profile.id : '',
  )

  return (
    <View style={styles.row}>
      <AppPressable
        accessibilityLabel={`Open ${post.author.displayName} profile`}
        onPress={() => router.push(profileRoute)}
        style={styles.avatar}>
        <Avatar name={post.author.displayName} uri={post.author.avatarUri} colour={post.author.coverColour} size={42} />
      </AppPressable>
      <AppPressable
        accessibilityLabel={`Open ${post.author.displayName} profile`}
        onPress={() => router.push(profileRoute)}
        style={styles.identity}>
        <AppText variant="label" numberOfLines={1}>{post.author.displayName}</AppText>
        <AppText variant="caption" colour="textSecondary" numberOfLines={1}>
          @{post.author.handle} · {relativeTime(post.createdAt)}
        </AppText>
      </AppPressable>
      {onMore ? (
        <AppPressable accessibilityLabel="Open post options" onPress={onMore} style={styles.more}>
          <AppIcon name="more" colour={colours.textTertiary} size={20} />
        </AppPressable>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  avatar: {alignItems: 'center', justifyContent: 'center'},
  identity: {flex: 1, justifyContent: 'center', minWidth: 0},
  more: {alignItems: 'center', justifyContent: 'center'},
  row: {alignItems: 'center', flexDirection: 'row', gap: 10},
})
