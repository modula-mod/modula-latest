import {Stack} from 'expo-router'

import {ChromeOverflowMenu} from '@/platform/ui/menus/chrome-overflow-menu'
import {nativeScreenHeaderOptions} from '@/platform/ui/navigation/native-screen-header'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export default function ActivityStackLayout() {
  const {colours} = useThemeTokens()

  return (
    <Stack
      screenOptions={{
        ...nativeScreenHeaderOptions({title: 'Activity'}),
        headerStyle: {backgroundColor: 'transparent'},
        headerTintColor: colours.text,
        headerTitleStyle: {color: colours.text},
        contentStyle: {backgroundColor: colours.canvas},
        headerRight: () => (
          <ChromeOverflowMenu
            accessibilityLabel="Filter activity"
            title="Filter"
            actions={[
              {id: 'all', label: 'All'},
              {id: 'replies', label: 'Replies'},
              {id: 'mentions', label: 'Mentions'},
              {id: 'follows', label: 'Follows'},
              {id: 'modules', label: 'Modules'},
              {id: 'teams', label: 'Teams'},
            ]}
            onAction={() => {
              /* ActivityScreen owns live filter state; menu is discovery chrome. */
            }}
          />
        ),
      }}>
      <Stack.Screen name="index" />
    </Stack>
  )
}
