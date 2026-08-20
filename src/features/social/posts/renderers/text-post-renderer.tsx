import {StyleSheet, View} from 'react-native'

import {AppText} from '@/components/primitives/AppText'
import type {TextPostContent} from '@/features/social/posts/types/post'
import {PostSurface} from '@/features/social/posts/components/post-surface'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function TextPostRenderer({content}: {content: TextPostContent}) {
  const {colours, spacing} = useThemeTokens()

  return (
    <View style={[styles.root, {padding: spacing[4]}]}>
      <PostSurface
        role="context"
        style={[
          styles.card,
          {
            borderColor: colours.borderStrong,
            padding: spacing[4],
          },
        ]}>
        <AppText variant="headline" style={{color: colours.mediaOverlayText, lineHeight: 32}}>
          {content.body}
        </AppText>
      </PostSurface>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    justifyContent: 'center',
  },
  root: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
  },
})
