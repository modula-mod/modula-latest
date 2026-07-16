import {useLocalSearchParams} from 'expo-router'
import {ScrollView, StyleSheet, View} from 'react-native'

import {DemoPostItem} from '@/components/feed/DemoPostItem'
import {AppText} from '@/components/primitives/AppText'
import {Avatar} from '@/components/primitives/Avatar'
import {EmptyState} from '@/components/primitives/EmptyState'
import {useDemoSocial} from '@/demo/DemoSocialContext'
import {demoProfiles} from '@/demo/demoProfiles'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const replies = [
  {
    id: 'reply-1',
    author: demoProfiles.design,
    text: 'This keeps the first phase focused on shell reliability instead of protocol complexity.',
    time: '12m',
  },
  {
    id: 'reply-2',
    author: demoProfiles.builders,
    text: 'The route-first structure also gives modules a clean place to attach later.',
    time: '7m',
  },
]

export function PostDetailScreen() {
  const {postId} = useLocalSearchParams<{postId: string}>()
  const {posts} = useDemoSocial()
  const {colours, spacing} = useThemeTokens()
  const post = posts.find(item => item.id === postId)

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title="Post" />
      <ResponsiveContent>
        {post ? (
          <ScrollView contentContainerStyle={{paddingBottom: spacing[8]}}>
            <DemoPostItem post={post} />
            <View style={[styles.thread, {paddingHorizontal: spacing[4]}]}>
              {replies.map(reply => (
                <View key={reply.id} style={styles.replyRow}>
                  <View style={styles.connectorWrap}>
                    <Avatar
                      name={reply.author.displayName}
                      colour={reply.author.avatarColour}
                      size={34}
                    />
                    <View
                      style={[styles.connector, {backgroundColor: colours.border}]}
                    />
                  </View>
                  <View style={styles.replyBody}>
                    <AppText variant="label">{reply.author.displayName}</AppText>
                    <AppText variant="caption" colour="textSecondary">
                      @{reply.author.handle} · {reply.time}
                    </AppText>
                    <AppText variant="body" style={{marginTop: spacing[1]}}>
                      {reply.text}
                    </AppText>
                  </View>
                </View>
              ))}
            </View>
            <View
              style={[
                styles.replyPrompt,
                {
                  borderColor: colours.border,
                  margin: spacing[4],
                  padding: spacing[4],
                },
              ]}>
              <AppText variant="headline">Add a local reply</AppText>
              <AppText variant="body" colour="textSecondary">
                Reply composition will connect after Phase 1 shell validation.
              </AppText>
            </View>
          </ScrollView>
        ) : (
          <EmptyState
            icon="comment"
            title="Post unavailable"
            description="This local demonstration post is no longer in memory."
          />
        )}
      </ResponsiveContent>
    </View>
  )
}

const styles = StyleSheet.create({
  connector: {
    flex: 1,
    marginTop: 8,
    width: 2,
  },
  connectorWrap: {
    alignItems: 'center',
  },
  replyBody: {
    flex: 1,
    minWidth: 0,
  },
  replyPrompt: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  replyRow: {
    flexDirection: 'row',
    gap: 12,
    minHeight: 92,
  },
  screen: {
    flex: 1,
  },
  thread: {
    paddingTop: 12,
  },
})
