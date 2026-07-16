import {StyleSheet, View} from 'react-native'

import {AppIcon, type AppIconName} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type DrawerItemModel = {
  label: string
  icon: AppIconName
  /** Optional; prefer 2-line captions or omit for dense account-panel rows. */
  description?: string
}

type DrawerItemProps = {
  item: DrawerItemModel
  onPress: () => void
}

export function DrawerItem({item, onPress}: DrawerItemProps) {
  const {colours, spacing} = useThemeTokens()
  return (
    <AppPressable
      accessibilityLabel={item.label}
      onPress={onPress}
      style={[styles.row, {gap: spacing[3]}]}>
      <View
        style={[
          styles.icon,
          {backgroundColor: colours.surfaceMuted, borderColor: colours.border},
        ]}>
        <AppIcon name={item.icon} colour={colours.textSecondary} size={20} />
      </View>
      <View style={styles.body}>
        <AppText variant="label">{item.label}</AppText>
        {item.description ? (
          <AppText variant="caption" colour="textSecondary" numberOfLines={2}>
            {item.description}
          </AppText>
        ) : null}
      </View>
      <AppIcon name="chevronRight" colour={colours.textTertiary} size={18} />
    </AppPressable>
  )
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    minWidth: 0,
  },
  icon: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 52,
  },
})
