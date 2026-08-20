import {StyleSheet, View} from 'react-native'

import {AppText} from '@/components/primitives/AppText'
import type {TextPostContent} from '@/features/social/posts/types/post'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function TextPostRenderer({content}: {content: TextPostContent}) {
  const {colours, spacing} = useThemeTokens()

  return (
    <View style={[styles.root, {backgroundColor: colours.surface2, padding: spacing[5]}]}>
      <AppText variant="headline" style={{color: colours.textMain, lineHeight: 32}}>
        {content.body}
      </AppText>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
  },
})
