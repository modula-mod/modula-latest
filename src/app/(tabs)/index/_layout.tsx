import {Stack} from 'expo-router'

import {
  HomeHeaderLeft,
  HomeHeaderRight,
  HomeHeaderTitle,
  homeHeaderLeftItems,
  homeHeaderRightItems,
} from '@/platform/ui/navigation/home-stack-header'
import {nativeScreenHeaderOptions} from '@/platform/ui/navigation/native-screen-header'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export default function HomeStackLayout() {
  const {colours} = useThemeTokens()
  const leftItems = homeHeaderLeftItems()
  const rightItems = homeHeaderRightItems()

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
        ...(leftItems
          ? {unstable_headerLeftItems: () => leftItems}
          : null),
        ...(rightItems
          ? {unstable_headerRightItems: () => rightItems}
          : null),
      }}>
      <Stack.Screen name="index" />
    </Stack>
  )
}
