import {Image} from 'expo-image'
import {Alert, StyleSheet, View} from 'react-native'

import {AppIcon} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import type {SocialPost} from '@/domain/social'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'
import {QuotedPost} from './quoted-post'

export function PostBody({post}: {post: SocialPost}) {
  const {colours, radius, spacing} = useThemeTokens()
  const text = post.text ? <AppText variant="body">{post.text}</AppText> : null
  const quote = post.quotedPost !== undefined ? <QuotedPost post={post.quotedPost} /> : null

  if (post.kind === 'media') {
    const media = post.media[0]
    return (
      <View style={{gap: spacing[3], marginTop: spacing[2]}}>
        {text}
        <View style={[styles.media, {aspectRatio: media?.aspectRatio ?? 4 / 5, backgroundColor: media?.colour ?? colours.surfaceMuted, borderRadius: radius.large}]}>
          {media?.url && !media.url.startsWith('local://') ? (
            <Image source={{uri: media.url}} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : (
            <AppText variant="headline" style={{color: colours.textSecondary}}>{media?.title ?? 'Modula media'}</AppText>
          )}
        </View>
        {quote}
      </View>
    )
  }

  if (post.kind === 'link') {
    return (
      <View style={{gap: spacing[3], marginTop: spacing[2]}}>
        {text}
        <AppPressable accessibilityLabel={`Open link preview ${post.link.title}`} onPress={() => Alert.alert(post.link.title, post.link.domain)}>
          <Surface variant="contained" style={[styles.link, {gap: spacing[1], padding: spacing[3]}]}>
            <AppText variant="caption" colour="textSecondary">{post.link.domain}</AppText>
            <AppText variant="headline">{post.link.title}</AppText>
            <AppText variant="caption" colour="textSecondary">{post.link.description}</AppText>
          </Surface>
        </AppPressable>
        {quote}
      </View>
    )
  }

  if (post.kind === 'module') {
    return (
      <View style={{gap: spacing[3], marginTop: spacing[2]}}>
        {text}
        <Surface variant="contained" style={[styles.module, {gap: spacing[3], padding: spacing[3]}]}>
          <AppIcon name="modules" colour={colours.accent} size={24} />
          <View style={styles.flex}>
            <AppText variant="headline">{post.module.name}</AppText>
            <AppText variant="caption" colour="textSecondary">{post.module.status}</AppText>
          </View>
        </Surface>
        {quote}
      </View>
    )
  }

  return text || quote ? <View style={{gap: spacing[3], marginTop: spacing[2]}}>{text}{quote}</View> : null
}

const styles = StyleSheet.create({
  flex: {flex: 1, minWidth: 0},
  link: {overflow: 'hidden'},
  media: {alignItems: 'center', justifyContent: 'center', overflow: 'hidden'},
  module: {alignItems: 'center', flexDirection: 'row'},
})
