import {Stack} from 'expo-router'

import {
  ActivityHeaderLeft,
  activityHeaderLeftItems,
} from '@/platform/ui/navigation/activity-stack-header'
import {nativeScreenHeaderOptions} from '@/platform/ui/navigation/native-screen-header'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export default function ActivityStackLayout() {
  const {colours} = useThemeTokens()
  const leftItems = activityHeaderLeftItems()

  return (
    <Stack
      screenOptions={{
        ...nativeScreenHeaderOptions({title: 'Activity'}),
        headerStyle: {backgroundColor: 'transparent'},
        headerTintColor: colours.text,
        headerTitleStyle: {color: colours.text},
        contentStyle: {backgroundColor: colours.canvas},
        headerLeft: () => <ActivityHeaderLeft />,
        ...(leftItems ? {unstable_headerLeftItems: () => leftItems} : null),
      }}>
      <Stack.Screen name="index" />
    </Stack>
  )
}
