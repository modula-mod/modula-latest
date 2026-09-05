import {ScrollView, StyleSheet, View, useWindowDimensions} from 'react-native'

import {AppText} from '@/components/primitives/AppText'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type ProductMetadataItem = {
  id: string
  value: string
  label: string
  detail?: string
}

export function ProductMetadataStrip({items}: {items: ProductMetadataItem[]}) {
  const {colours, radius} = useThemeTokens()
  const {fontScale, width} = useWindowDimensions()
  const scrollable = fontScale > 1.15 || width < items.length * 92
  const content = items.map((item, index) => (
    <View
      key={item.id}
      style={[styles.item, scrollable ? styles.scrollItem : styles.fitItem]}
      accessibilityLabel={`${item.label}: ${item.value}${item.detail ? `. ${item.detail}` : ''}`}>
      {index > 0 ? (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[styles.divider, {backgroundColor: colours.separator}]}
        />
      ) : null}
      <AppText variant="metricValue" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.9} style={styles.value}>
        {item.value}
      </AppText>
      <AppText variant="metricLabel" colour="textTertiary" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.9} style={styles.label}>
        {item.label.toUpperCase()}
      </AppText>
      {item.detail ? (
        <AppText variant="caption" colour="textSecondary" numberOfLines={2} style={styles.detail}>
          {item.detail}
        </AppText>
      ) : null}
    </View>
  ))
  return (
    <View
      accessibilityLabel="Product metadata"
      style={[styles.frame, {borderColor: colours.border, borderRadius: radius.xlarge}]}
      testID="product-metadata-strip">
      {scrollable ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.content}>
          {content}
        </ScrollView>
      ) : (
        <View style={styles.content}>{content}</View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  content: {alignItems: 'stretch', flexDirection: 'row'},
  detail: {textAlign: 'center'},
  divider: {bottom: 10, left: 0, position: 'absolute', top: 10, width: StyleSheet.hairlineWidth},
  fitItem: {flex: 1, minWidth: 0},
  frame: {borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden'},
  item: {alignItems: 'center', justifyContent: 'center', minHeight: 66, paddingHorizontal: 4, paddingVertical: 7},
  label: {fontWeight: '700', letterSpacing: 0.2, textAlign: 'center'},
  scrollItem: {minWidth: 90},
  value: {fontVariant: ['tabular-nums'], textAlign: 'center'},
})
