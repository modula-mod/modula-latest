import {Host, Menu, RNHostView} from '@expo/ui/swift-ui'
import type {ReactNode} from 'react'
import {View} from 'react-native'

import {renderTapMenuItems} from '@/platform/ui/menus/native-menu-items'
import type {ModulaActionItem} from '@/platform/ui/menus/types'

type ModulaMenuProps = {
  trigger: ReactNode
  title?: string
  actions: ModulaActionItem[]
  onAction: (actionId: string) => void
  accessibilityLabel?: string
  disabled?: boolean
}

/**
 * Tap Menu via Expo UI SwiftUI Menu on iOS.
 * RN trigger is hosted as the Menu label through RNHostView.
 */
export function ModulaMenu({
  trigger,
  actions,
  onAction,
  accessibilityLabel = 'Open menu',
  disabled,
}: ModulaMenuProps) {
  if (disabled) {
    return <View accessibilityLabel={accessibilityLabel}>{trigger}</View>
  }

  return (
    <Host matchContents>
      <Menu
        label={
          <RNHostView matchContents>
            <View accessibilityLabel={accessibilityLabel} accessibilityRole="button">
              {trigger}
            </View>
          </RNHostView>
        }>
        {renderTapMenuItems(actions, onAction)}
      </Menu>
    </Host>
  )
}
