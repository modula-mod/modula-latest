import {StyleSheet, View} from 'react-native'

import {AppText} from '@/components/primitives/AppText'
import type {TextPostContent} from '@/features/social/posts/types/post'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function TextPostRenderer({
  content,
  layout = 'fill',
}: {
  content: TextPostContent
  layout?: 'fill' | 'flow'
}) {
  const {colours, spacing} = useThemeTokens()
  const flow = layout === 'flow'

  return (
    <View
      style={[
        flow ? styles.flow : styles.fill,
        {
          backgroundColor: flow ? 'transparent' : colours.surface2,
          padding: flow ? spacing[1] : spacing[5],
        },
      ]}>
      <AppText
        variant={flow ? 'body' : 'headline'}
        style={{
          color: colours.textMain,
          lineHeight: flow ? undefined : 32,
        }}>
        {content.body}
      </AppText>
    </View>
  )
}

const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
  },
  flow: {
    width: '100%',
  },
})
