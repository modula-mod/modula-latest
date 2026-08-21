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
  const {fontScale} = useWindowDimensions()
  const scrollable = fontScale > 1.2
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
      <AppText variant="headline" numberOfLines={1} adjustsFontSizeToFit style={styles.value}>
        {item.value}
      </AppText>
      <AppText variant="micro" colour="textTertiary" numberOfLines={1} style={styles.label}>
        {item.label.toUpperCase()}
      </AppText>
      {item.detail ? (
        <AppText variant="micro" colour="textSecondary" numberOfLines={2} style={styles.detail}>
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
  detail: {fontSize: 9, lineHeight: 12, textAlign: 'center'},
  divider: {bottom: 14, left: 0, position: 'absolute', top: 14, width: StyleSheet.hairlineWidth},
  fitItem: {flex: 1, minWidth: 0},
  frame: {borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden'},
  item: {alignItems: 'center', justifyContent: 'center', minHeight: 84, paddingHorizontal: 6, paddingVertical: 10},
  label: {fontSize: 9, fontWeight: '700', letterSpacing: 0.35, lineHeight: 12},
  scrollItem: {minWidth: 106},
  value: {fontSize: 15, lineHeight: 19, textAlign: 'center'},
})
