import {StyleSheet, View} from 'react-native'
import type {SocialRecordOrigin} from '@modula/api-contracts'

import {AppText} from '@/components/primitives/AppText'
import {ORIGIN_LABELS} from '@/features/atproto/copy'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function OriginLabel({origin}: {origin: SocialRecordOrigin}) {
  const {colours, radius, spacing} = useThemeTokens()
  return (
    <View
      style={[
        styles.chip,
        {
          backgroundColor: colours.accentSubtle,
          borderColor: colours.accentBorder,
          borderRadius: radius.sm,
          paddingHorizontal: spacing[2],
          paddingVertical: spacing[1],
        },
      ]}>
      <AppText variant="caption" style={{color: colours.accent}}>
        {ORIGIN_LABELS[origin]}
      </AppText>
    </View>
  )
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth,
  },
})
