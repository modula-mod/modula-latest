import {ScrollView, StyleSheet, View} from 'react-native'

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
  return (
    <View style={[styles.frame, {backgroundColor: colours.surfaceRaised, borderRadius: radius.xlarge}]} testID="product-information-strip">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.content}>
        {items.map((item, index) => {
          const body = (
            <>
              {index > 0 ? <View accessibilityElementsHidden style={[styles.divider, {backgroundColor: colours.separator}]} /> : null}
              <View style={[styles.labelRow, {gap: spacing[1]}]}>
                <ModulaIcon name={item.icon} size={19} colour={colours.text} />
                <AppText variant="caption" style={styles.label}>{item.label}</AppText>
              </View>
              <AppText variant="caption" colour="textSecondary">{item.value}</AppText>
            </>
          )
          return item.onPress ? (
            <AppPressable
              key={item.id}
              accessibilityLabel={`${item.label}: ${item.value}. Open details`}
              onPress={item.onPress}
              style={styles.item}>
              {body}
            </AppPressable>
          ) : (
            <View key={item.id} accessibilityLabel={`${item.label}: ${item.value}`} style={styles.item}>{body}</View>
          )
        })}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  content: {alignItems: 'stretch'},
  divider: {bottom: 14, left: 0, position: 'absolute', top: 14, width: StyleSheet.hairlineWidth},
  frame: {overflow: 'hidden'},
  item: {justifyContent: 'center', minHeight: 88, minWidth: 138, paddingHorizontal: 16, paddingVertical: 12},
  label: {fontWeight: '700'},
  labelRow: {alignItems: 'center', flexDirection: 'row'},
})
