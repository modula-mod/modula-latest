import {Alert, StyleSheet, View} from 'react-native'
import {Image} from 'expo-image'

import {AppIcon} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import type {LinkPostContent} from '@/features/social/posts/types/post'
import {PostSurface} from '@/features/social/posts/components/post-surface'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function LinkPostRenderer({content}: {content: LinkPostContent}) {
  const {colours, spacing} = useThemeTokens()
  const {preview} = content

  return (
    <View style={[styles.root, {padding: spacing[4]}]}>
      <AppPressable
        accessibilityLabel={`Open link ${preview.title}`}
        onPress={() => Alert.alert(preview.title, preview.domain)}
        style={{flex: 1, justifyContent: 'center'}}>
        <PostSurface
          role="context"
          style={[
            styles.card,
            {
              borderColor: colours.borderStrong,
              overflow: 'hidden',
            },
          ]}>
          {preview.image ? (
            <Image source={{uri: preview.image}} style={styles.previewImage} contentFit="cover" />
          ) : (
            <View style={[styles.previewImage, {backgroundColor: colours.surface3}]} />
          )}
          <View style={{gap: spacing[1], padding: spacing[3]}}>
            <AppText variant="caption" style={{color: colours.mediaOverlaySecondary}}>
              {preview.domain}
            </AppText>
            <AppText variant="headline" style={{color: colours.mediaOverlayText}}>
              {preview.title}
            </AppText>
            <AppText variant="body" style={{color: colours.mediaOverlaySecondary}} numberOfLines={2}>
              {preview.description}
            </AppText>
            <View style={styles.linkRow}>
              <AppIcon name="link" colour={colours.mediaOverlayIcon} size={16} />
            </View>
          </View>
        </PostSurface>
      </AppPressable>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  linkRow: {
    alignItems: 'flex-end',
  },
  previewImage: {
    aspectRatio: 16 / 9,
    width: '100%',
  },
  root: {
    ...StyleSheet.absoluteFill,
  },
})
