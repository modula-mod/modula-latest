import {KonstaNavigationMenu} from '@/platform/ui/adapters/konsta/navigation-menu.web'
import type {ModulaNavigationMenuProps} from '@/platform/ui/navigation/modula-navigation-menu'

export function ModulaNavigationMenu({
  accessibilityLabel = 'Navigation',
  items,
  testID,
}: ModulaNavigationMenuProps) {
  return (
    <KonstaNavigationMenu
      accessibilityLabel={accessibilityLabel}
      items={items}
      testID={testID}
    />
  )
}
