import {useState} from 'react'
import {View} from 'react-native'

import {AppText} from '@/components/primitives/AppText'
import {ModulaContextMenu} from '@/platform/ui/menus/modula-context-menu'
import type {ModulaActionItem} from '@/platform/ui/menus/types'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

/**
 * Web / Android lab: product adapter with nested Mute and a tab picker.
 * iOS uses the SwiftUI ContextMenu section.
 */
export function ContextMenuSection() {
  const {spacing} = useThemeTokens()
  const [tab, setTab] = useState('posts')
  const actions: ModulaActionItem[] = [
    {id: 'share', label: 'Share', icon: 'share'},
    {
      id: 'mute',
      label: 'Mute',
      icon: 'notifications',
      children: [
        {id: 'mute-8h', label: '8 hours'},
        {id: 'mute-1w', label: '1 week'},
        {id: 'mute-forever', label: 'Forever'},
      ],
    },
    {
      id: 'open-tab',
      label: 'Open tab',
      icon: 'board',
      picker: {
        options: [
          {id: 'posts', label: 'Posts'},
          {id: 'media', label: 'Media'},
          {id: 'about', label: 'About'},
        ],
        selectedId: tab,
      },
    },
    {id: 'delete', label: 'Delete', icon: 'trash', style: 'destructive'},
  ]

  return (
    <View style={{gap: spacing[3], padding: spacing[4]}}>
      <AppText variant="headline">Context menus</AppText>
      <AppText variant="caption" colour="textSecondary">
        Long-press for nested Mute, a tab picker, and a destructive row. Web
        flattens these into an action sheet.
      </AppText>
      <ModulaContextMenu
        accessibilityLabel="Sample context menu"
        title="Actions"
        actions={actions}
        onAction={id => {
          if (id === 'posts' || id === 'media' || id === 'about') setTab(id)
        }}>
        <AppText variant="body">Long-press this row · tab {tab}</AppText>
      </ModulaContextMenu>
    </View>
  )
}
