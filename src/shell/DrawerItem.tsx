import {StyleSheet, View} from 'react-native'

import {AppIcon, type AppIconName} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type DrawerItemModel = {
  label: string
  icon: AppIconName
  /** Optional; omit for dense account-panel / Settings-style rows. */
  description?: string
}

type DrawerItemProps = {
  item: DrawerItemModel
  onPress: () => void
  /** Apple-like selected row when the destination matches the current route. */
  selected?: boolean
  /** Dense = label only, quieter chrome (Settings list feel). */
  dense?: boolean
}

export function DrawerItem({item, onPress, selected = false, dense = false}: DrawerItemProps) {
  const {colours, spacing, radius} = useThemeTokens()
  const showDescription = !dense && Boolean(item.description)

  return (
    <AppPressable
      accessibilityLabel={item.label}
      accessibilityState={{selected}}
      onPress={onPress}
      style={[
        styles.row,
        {
          gap: spacing[3],
          minHeight: dense ? 44 : showDescription ? 56 : 48,
          paddingVertical: dense ? spacing[2] : spacing[2],
          paddingHorizontal: spacing[2],
          borderRadius: radius.medium,
          backgroundColor: selected ? colours.accentSubtle : 'transparent',
        },
      ]}>
      <View
        style={[
          styles.icon,
          {
            backgroundColor: selected ? colours.accentSubtle : colours.surfaceMuted,
            borderColor: selected ? colours.accentBorder : colours.border,
            borderRadius: radius.medium,
          },
        ]}>
        <AppIcon
          name={item.icon}
          colour={selected ? colours.text : colours.textSecondary}
          size={dense ? 18 : 20}
        />
      </View>
      <View style={styles.body}>
        <AppText
          variant={dense ? 'body' : 'label'}
          colour="text"
          numberOfLines={1}>
          {item.label}
        </AppText>
        {showDescription ? (
          <AppText variant="caption" colour="textSecondary" numberOfLines={2}>
            {item.description}
          </AppText>
        ) : null}
      </View>
      <AppIcon
        name="chevronRight"
        colour={selected ? colours.text : colours.textTertiary}
        size={16}
      />
    </AppPressable>
  )
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    flexShrink: 1,
    minWidth: 64,
  },
  icon: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flexShrink: 0,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  row: {
    alignItems: 'center',
    alignSelf: 'stretch',
    flexDirection: 'row',
    width: '100%',
  },
})
