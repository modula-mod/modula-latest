import {Stack} from 'expo-router'
import {Pressable} from 'react-native'

import {AppIcon} from '@/components/primitives/AppIcon'
import {presentModulaActions} from '@/platform/ui/menus/presentModulaActions'
import {nativeScreenHeaderOptions} from '@/platform/ui/navigation/native-screen-header'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export default function ActivityStackLayout() {
  const {colours} = useThemeTokens()

  return (
    <Stack
      screenOptions={{
        ...nativeScreenHeaderOptions({title: 'Activity'}),
        headerStyle: {backgroundColor: colours.canvas},
        headerTintColor: colours.text,
        headerTitleStyle: {color: colours.text},
        contentStyle: {backgroundColor: colours.canvas},
        headerRight: () => (
          <Pressable
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
            style={{
              alignItems: 'center',
              height: 44,
              justifyContent: 'center',
              width: 44,
            }}>
            <AppIcon name="more" colour={colours.textSecondary} size={22} />
          </Pressable>
        ),
      }}>
      <Stack.Screen name="index" />
    </Stack>
  )
}
