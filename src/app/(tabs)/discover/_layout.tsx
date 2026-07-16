import {Stack} from 'expo-router'

import {nativeScreenHeaderOptions} from '@/platform/ui/navigation/native-screen-header'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export default function DiscoverStackLayout() {
  const {colours} = useThemeTokens()

  return (
    <Stack
      screenOptions={{
        ...nativeScreenHeaderOptions({title: 'Discover'}),
        headerStyle: {backgroundColor: colours.canvas},
        headerTintColor: colours.text,
        headerTitleStyle: {color: colours.text},
        contentStyle: {backgroundColor: colours.canvas},
        headerSearchBarOptions: {
          placeholder: 'Search Modula',
          hideWhenScrolling: false,
        },
      }}>
      <Stack.Screen name="index" />
    </Stack>
  )
}
