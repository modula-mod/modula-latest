import {StyleSheet, View} from 'react-native'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {PostSurface} from '@/features/social/posts/components/post-surface'
import type {ReactionOption} from '@/features/social/posts/state/post-interaction-types'
import {POST_GEOMETRY} from '@/features/social/posts/tokens/post-geometry'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type CustomReactionPickerProps = {
  options: ReactionOption[]
  onSelect: (reaction: string) => void
  onClose: () => void
}

export function CustomReactionPicker({options, onSelect, onClose}: CustomReactionPickerProps) {
  const {colours, spacing} = useThemeTokens()

  return (
    <PostSurface
      role="reaction"
      style={[
        styles.panel,
        {
          borderColor: colours.borderStrong,
          borderRadius: POST_GEOMETRY.contextMenuRadius,
          padding: spacing[3],
        },
      ]}>
      <AppText variant="label" style={{color: colours.mediaOverlayText, marginBottom: spacing[2]}}>
        Custom reactions
      </AppText>
      <View style={styles.grid}>
        {options.map(option => (
          <AppPressable
            key={`${option.type}-${option.emoji}`}
            accessibilityLabel={option.label}
            onPress={() => {
              onSelect(option.type)
              onClose()
            }}
            style={styles.cell}>
            <AppText variant="title">{option.emoji}</AppText>
          </AppPressable>
        ))}
      </View>
    </PostSurface>
  )
}

const styles = StyleSheet.create({
  cell: {
    alignItems: 'center',
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  panel: {
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: 320,
    width: '88%',
  },
})
