import {StyleSheet, View} from 'react-native'

import {AppAvatar} from '@/components/primitives/AppAvatar'
import {AppDivider} from '@/components/primitives/AppDivider'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import type {SocialPost} from '@/social/contracts/SocialProvider'
import {useTheme} from '@/theme/runtime/useTheme'

type FeedPostRowProps = {
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

/**
 * Bluesky-inspired density without AT Proto types.
 * Text breathes — open layout, no heavy card chrome.
 */
export function FeedPostRow({post}: FeedPostRowProps) {
  const {colours, spacing} = useTheme()

  return (
    <View>
      <View style={[styles.row, {paddingHorizontal: spacing.lg, paddingVertical: spacing.md}]}>
        <AppAvatar name={post.author.displayName} uri={post.author.avatarUrl} size={44} />
        <View style={styles.body}>
          <View style={styles.meta}>
            <AppText variant="label" numberOfLines={1} style={styles.name}>
              {post.author.displayName}
            </AppText>
            <AppText variant="caption" colour="textSecondary" numberOfLines={1}>
              @{post.author.handle} · {formatRelative(post.createdAt)}
            </AppText>
          </View>
          <AppText variant="body" style={{marginTop: spacing.xs, lineHeight: 22}}>
            {post.text}
          </AppText>
          <View style={[styles.actions, {marginTop: spacing.md}]}>
            {(['Reply', 'Repost', 'Like', 'Share'] as const).map(label => (
              <AppPressable
                key={label}
                accessibilityLabel={label}
                onPress={() => {}}
                style={styles.action}>
                <AppText variant="caption" colour="textSecondary">
                  {label}
                </AppText>
              </AppPressable>
            ))}
          </View>
        </View>
      </View>
      <AppDivider style={{backgroundColor: colours.border}} />
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  meta: {
    gap: 2,
  },
  name: {
    marginRight: 8,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    maxWidth: 320,
  },
  action: {
    paddingVertical: 4,
    paddingRight: 8,
  },
})
