import {Stack} from 'expo-router'

import {
  HomeHeaderLeft,
  HomeHeaderRight,
  HomeHeaderTitle,
} from '@/platform/ui/navigation/home-stack-header'
import {nativeScreenHeaderOptions} from '@/platform/ui/navigation/native-screen-header'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export default function HomeStackLayout() {
  const {colours} = useThemeTokens()

  return (
    <Stack
      screenOptions={{
        ...nativeScreenHeaderOptions({title: 'Modula'}),
        headerStyle: {backgroundColor: 'transparent'},
        headerTintColor: colours.text,
        headerTitleStyle: {color: colours.text},
        contentStyle: {backgroundColor: colours.canvas},
        headerTitle: () => <HomeHeaderTitle />,
        headerLeft: () => <HomeHeaderLeft />,
        headerRight: () => <HomeHeaderRight />,
      }}>
      <Stack.Screen name="index" />
    </Stack>
  )
}
