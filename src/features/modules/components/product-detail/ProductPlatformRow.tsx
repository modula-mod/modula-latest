import {StyleSheet, View} from 'react-native'

import {AppText} from '@/components/primitives/AppText'
import {ModulaIcon} from '@/platform/ui/icons'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const LABELS: Record<string, string> = {ios: 'iOS', android: 'Android', web: 'Web'}

export function ProductPlatformRow({platforms}: {platforms: string[]}) {
  const {colours, spacing} = useThemeTokens()
  const visible = platforms.filter(platform => platform in LABELS)
  return (
    <View style={{gap: spacing[2]}} testID="product-platform-row">
      <AppText variant="sectionTitle" accessibilityRole="header">Compatibility</AppText>
      <View
        accessibilityLabel={visible.length ? `Platforms: ${visible.map(platform => LABELS[platform]).join(', ')}` : 'Platform compatibility not declared'}
        style={[styles.row, {borderColor: colours.separator, gap: spacing[3]}]}>
        <ModulaIcon name="module" size={18} colour={colours.textTertiary} />
        <AppText variant="caption" colour="textSecondary">
          {visible.length ? visible.map(platform => LABELS[platform]).join(' · ') : 'Not declared for this release'}
        </AppText>
        <View style={styles.spacer} />
        <ModulaIcon name="chevronRight" size={15} colour={colours.textTertiary} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', minHeight: 48, paddingVertical: 10},
  spacer: {flex: 1},
})
