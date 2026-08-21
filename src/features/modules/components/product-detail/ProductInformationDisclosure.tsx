import {StyleSheet, View} from 'react-native'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {ModulaIcon} from '@/platform/ui/icons'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function ProductInformationDisclosure({label = 'Information', onPress}: {label?: string; onPress: () => void}) {
  const {colours} = useThemeTokens()
  return (
    <AppPressable
      accessibilityLabel={`Open ${label}`}
      onPress={onPress}
      style={[styles.row, {borderBottomColor: colours.separator, borderTopColor: colours.separator}]}
      testID="product-information-disclosure">
      <AppText variant="label">{label}</AppText>
      <View style={styles.trailing}>
        <AppText variant="caption" colour="textTertiary">Privacy, source and technical details</AppText>
        <ModulaIcon name="chevronRight" size={16} colour={colours.textTertiary} />
      </View>
    </AppPressable>
  )
}

const styles = StyleSheet.create({
  row: {alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', justifyContent: 'space-between', minHeight: 52, paddingVertical: 12},
  trailing: {alignItems: 'center', flexDirection: 'row', flexShrink: 1, gap: 6, justifyContent: 'flex-end'},
})
