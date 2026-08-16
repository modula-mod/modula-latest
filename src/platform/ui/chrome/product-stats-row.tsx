import {StyleSheet, View} from 'react-native'

import {AppText} from '@/components/primitives/AppText'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type ProductStatItem = {
  label: string
  value: string
  detail?: string
}

/**
 * App Store product-page metadata: centred columns, hairline dividers.
 * Values must be honest — never invent ratings or downloads.
 */
export function ProductStatsRow({items}: {items: ProductStatItem[]}) {
  const {colours, spacing} = useThemeTokens()
  if (!items.length) return null

  return (
    <View
      accessibilityRole="summary"
      style={[styles.row, {paddingVertical: spacing[3]}]}>
      {items.map((item, index) => (
        <View
          key={item.label}
          style={[
            styles.cell,
            {
              borderLeftColor: colours.separator,
              borderLeftWidth: index === 0 ? 0 : StyleSheet.hairlineWidth,
              paddingHorizontal: spacing[2],
            },
          ]}>
          <AppText variant="micro" colour="textTertiary" style={styles.label}>
            {item.label.toUpperCase()}
          </AppText>
          <AppText variant="headline" style={styles.value} numberOfLines={1}>
            {item.value}
          </AppText>
          {item.detail ? (
            <AppText variant="caption" colour="textTertiary" numberOfLines={1}>
              {item.detail}
            </AppText>
          ) : null}
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  cell: {
    alignItems: 'center',
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  label: {
    textAlign: 'center',
  },
  row: {
    alignItems: 'stretch',
    flexDirection: 'row',
    width: '100%',
  },
  value: {
    textAlign: 'center',
  },
})
