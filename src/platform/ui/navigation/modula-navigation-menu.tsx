import type {ReactNode} from 'react'
import {View} from 'react-native'

import {ModulaListRow} from '@/platform/ui/lists'

export type ModulaNavigationMenuItem = {
  id: string
  label: string
  description?: string
  leading?: ReactNode
  active?: boolean
  disabled?: boolean
  onPress: () => void
}

export type ModulaNavigationMenuProps = {
  accessibilityLabel?: string
  items: readonly ModulaNavigationMenuItem[]
  testID?: string
}

export function ModulaNavigationMenu({
  accessibilityLabel = 'Navigation',
  items,
  testID,
}: ModulaNavigationMenuProps) {
  return (
    <View accessibilityLabel={accessibilityLabel} accessibilityRole="menu" testID={testID}>
      {items.map((item, index) => (
        <ModulaListRow
          accessibilityState={{disabled: item.disabled, selected: item.active}}
          description={item.description}
          disabled={item.disabled}
          key={item.id}
          last={index === items.length - 1}
          leading={item.leading}
          onPress={item.onPress}
          selected={item.active}
          title={item.label}
          variant="navigation"
        />
      ))}
    </View>
  )
}
