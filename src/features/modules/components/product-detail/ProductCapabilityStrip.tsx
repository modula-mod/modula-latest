import {ScrollView, StyleSheet, View, useWindowDimensions} from 'react-native'

import {AppText} from '@/components/primitives/AppText'
import {ModulaIcon, type ModulaIconName} from '@/platform/ui/icons'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type ProductCapabilityItem = {
  id: string
  icon: ModulaIconName
  label: string
  value: string
  detail: string
}

export function ProductCapabilityStrip({items}: {items: ProductCapabilityItem[]}) {
  const {colours, radius, spacing} = useThemeTokens()
  const {fontScale, width} = useWindowDimensions()
  const scrollable = fontScale > 1.15 || width < 380
  const content = items.map((item, index) => (
    <View
      key={item.id}
      accessibilityLabel={`${item.label}: ${item.value}. ${item.detail}`}
      style={[styles.item, scrollable ? styles.scrollItem : styles.fitItem, {gap: spacing[1]}]}>
      {index > 0 ? (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[styles.divider, {backgroundColor: colours.separator}]}
        />
      ) : null}
      <View style={[styles.labelRow, {gap: spacing[1]}]}>
        <ModulaIcon name={item.icon} size={17} colour={colours.text} />
        <AppText variant="caption" numberOfLines={2} style={styles.label}>{item.label}</AppText>
      </View>
      <AppText variant="label" numberOfLines={2} style={styles.value}>{item.value}</AppText>
      <AppText variant="micro" colour="textTertiary" numberOfLines={2} style={styles.detail}>
        {item.detail}
      </AppText>
    </View>
  ))
  return (
    <View style={{gap: spacing[3]}} testID="product-capability-strip">
      <AppText variant="headline" accessibilityRole="header">Trust &amp; capabilities</AppText>
      <View style={[styles.frame, {borderColor: colours.border, borderRadius: radius.xlarge}]}>
        {scrollable ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.content}>
            {content}
          </ScrollView>
        ) : (
          <View style={styles.content}>{content}</View>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  content: {alignItems: 'stretch', flexDirection: 'row'},
  detail: {fontSize: 9, lineHeight: 12},
  divider: {bottom: 14, left: 0, position: 'absolute', top: 14, width: StyleSheet.hairlineWidth},
  fitItem: {flex: 1, minWidth: 0},
  frame: {borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden'},
  item: {justifyContent: 'center', minHeight: 108, paddingHorizontal: 9, paddingVertical: 12},
  label: {fontSize: 10, fontWeight: '700', lineHeight: 13},
  labelRow: {alignItems: 'center', flexDirection: 'row'},
  scrollItem: {minWidth: 148},
  value: {fontSize: 12, lineHeight: 15},
})
