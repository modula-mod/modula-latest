import {StyleSheet, View} from 'react-native'

import {AppText} from '@/components/primitives/AppText'
import {ModulaIcon} from '@/platform/ui/icons'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const LABELS: Record<string, string> = {ios: 'iOS', android: 'Android', web: 'Web'}

export function ProductPlatformRow({platforms}: {platforms: string[]}) {
  const {colours, spacing} = useThemeTokens()
  const visible = platforms.filter(platform => platform in LABELS)
  if (!visible.length) return null
  return (
    <View
      accessibilityLabel={`Platforms: ${visible.map(platform => LABELS[platform]).join(', ')}`}
      style={[styles.row, {borderColor: colours.separator, gap: spacing[3]}]}
      testID="product-platform-row">
      <ModulaIcon name="module" size={18} colour={colours.textTertiary} />
      <AppText variant="caption" colour="textSecondary">
        {visible.map(platform => LABELS[platform]).join(' · ')}
      </AppText>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', minHeight: 48, paddingVertical: 10},
})
