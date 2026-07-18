import {Stack} from 'expo-router'

import {ChromeCircleButton} from '@/components/primitives/ChromeCircleButton'
import {presentModulaActions} from '@/platform/ui/menus/presentModulaActions'
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
          <ChromeCircleButton
            icon="more"
            accessibilityLabel="Filter activity"
            onPress={() => {
              void presentModulaActions({
                title: 'Filter',
                actions: [
                  {id: 'all', label: 'All'},
                  {id: 'replies', label: 'Replies'},
                  {id: 'mentions', label: 'Mentions'},
                  {id: 'follows', label: 'Follows'},
                  {id: 'modules', label: 'Modules'},
                  {id: 'teams', label: 'Teams'},
                ],
              })
            }}
          />
        ),
      }}>
      <Stack.Screen name="index" />
    </Stack>
  )
}
