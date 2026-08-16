import {Stack} from 'expo-router'

import {ChromeOverflowMenu} from '@/platform/ui/menus/chrome-overflow-menu'
import {nativeScreenHeaderOptions} from '@/platform/ui/navigation/native-screen-header'
import {
  plainHeaderCustomItem,
  supportsPlainHeaderItems,
} from '@/platform/ui/navigation/plain-header-items'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

function ActivityFilterMenu() {
  return (
    <ChromeOverflowMenu
      accessibilityLabel="Filter activity"
      title="Filter"
      actions={[
        {id: 'all', label: 'All', icon: 'activity'},
        {id: 'replies', label: 'Replies', icon: 'comment'},
        {id: 'mentions', label: 'Mentions', icon: 'messages'},
        {id: 'follows', label: 'Follows', icon: 'people'},
        {id: 'modules', label: 'Modules', icon: 'modules'},
        {id: 'teams', label: 'Teams', icon: 'teams'},
      ]}
      onAction={() => {
        /* ActivityScreen owns live filter state; menu is discovery chrome. */
      }}
    />
  )
}

export default function ActivityStackLayout() {
  const {colours} = useThemeTokens()
  const rightItems = supportsPlainHeaderItems()
    ? [plainHeaderCustomItem(<ActivityFilterMenu />)]
    : undefined

  return (
    <Stack
      screenOptions={{
        ...nativeScreenHeaderOptions({title: 'Activity'}),
        headerStyle: {backgroundColor: 'transparent'},
        headerTintColor: colours.text,
        headerTitleStyle: {color: colours.text},
        contentStyle: {backgroundColor: colours.canvas},
        headerRight: () => <ActivityFilterMenu />,
        ...(rightItems
          ? {unstable_headerRightItems: () => rightItems}
          : null),
      }}>
      <Stack.Screen name="index" />
    </Stack>
  )
}
