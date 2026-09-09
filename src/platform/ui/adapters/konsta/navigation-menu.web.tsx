import {ListItem, MenuList} from 'konsta/react'
import type {ReactNode} from 'react'

export type KonstaNavigationMenuItem = {
  id: string
  label: string
  description?: string
  leading?: ReactNode
  active?: boolean
  disabled?: boolean
  onPress: () => void
}

export function KonstaNavigationMenu({
  accessibilityLabel,
  items,
  testID,
}: {
  accessibilityLabel: string
  items: readonly KonstaNavigationMenuItem[]
  testID?: string
}) {
  return (
    <nav aria-label={accessibilityLabel} data-testid={testID}>
      <MenuList className="modula-konsta-navigation-menu">
        {items.map(item => (
          <ListItem
            className="modula-konsta-navigation-item"
            component="li"
            key={item.id}
            linkComponent="button"
            linkProps={{
              'aria-current': item.active ? 'page' : undefined,
              disabled: item.disabled,
              onClick: item.onPress,
              type: 'button',
            }}
            media={item.leading}
            menuListItem
            menuListItemActive={item.active}
            subtitle={item.description}
            title={item.label}
          />
        ))}
      </MenuList>
    </nav>
  )
}
