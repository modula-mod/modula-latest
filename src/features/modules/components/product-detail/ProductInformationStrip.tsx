import {ScrollView, StyleSheet, View, useWindowDimensions} from 'react-native'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {ModulaIcon, type ModulaIconName} from '@/platform/ui/icons'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type ProductInformationItem = {
  id: string
  icon: ModulaIconName
  label: string
  value: string
  onPress?: () => void
}

export function ProductInformationStrip({items}: {items: ProductInformationItem[]}) {
  const {colours, radius, spacing} = useThemeTokens()
  const {fontScale, width} = useWindowDimensions()
  const scrollable = fontScale > 1.15 || width < 380
  const content = items.map((item, index) => {
    const body = (
      <>
        {index > 0 ? <View accessibilityElementsHidden style={[styles.divider, {backgroundColor: colours.separator}]} /> : null}
        <View style={[styles.labelRow, {gap: spacing[1]}]}>
          <ModulaIcon name={item.icon} size={19} colour={colours.text} />
          <AppText variant="caption" numberOfLines={2} style={styles.label}>{item.label}</AppText>
        </View>
        <AppText variant="caption" colour="textSecondary" numberOfLines={2}>{item.value}</AppText>
      </>
    )
    const itemStyle = [styles.item, scrollable ? styles.scrollItem : styles.fitItem]
    return item.onPress ? (
      <AppPressable
        key={item.id}
        accessibilityLabel={`${item.label}: ${item.value}. Open details`}
        onPress={item.onPress}
        style={itemStyle}>
        {body}
      </AppPressable>
    ) : (
      <View key={item.id} accessibilityLabel={`${item.label}: ${item.value}`} style={itemStyle}>{body}</View>
    )
  })
  return (
    <View style={[styles.frame, {backgroundColor: colours.surfaceRaised, borderRadius: radius.xlarge}]} testID="product-information-strip">
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
  content: {alignItems: 'stretch', flexDirection: 'row', flexGrow: 1},
  divider: {bottom: 14, left: 0, position: 'absolute', top: 14, width: StyleSheet.hairlineWidth},
  fitItem: {flex: 1, minWidth: 0},
  frame: {overflow: 'hidden'},
  item: {justifyContent: 'center', minHeight: 76, paddingHorizontal: 8, paddingVertical: 9},
  label: {fontWeight: '700'},
  labelRow: {alignItems: 'flex-start'},
  scrollItem: {minWidth: 124},
})
