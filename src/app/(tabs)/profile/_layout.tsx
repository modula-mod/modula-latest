import {Stack} from 'expo-router'

import {nativeScreenHeaderOptions} from '@/platform/ui/navigation/native-screen-header'
import {ProfileHeaderRight} from '@/platform/ui/navigation/profile-stack-header'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export default function ProfileStackLayout() {
  const {colours} = useThemeTokens()

  return (
    <Stack
      screenOptions={{
        ...nativeScreenHeaderOptions({title: 'Profile'}),
        headerStyle: {backgroundColor: 'transparent'},
        headerTintColor: colours.text,
        headerTitleStyle: {color: colours.text},
        contentStyle: {backgroundColor: colours.canvas},
        headerRight: () => <ProfileHeaderRight />,
      }}>
      <Stack.Screen name="index" />
    </Stack>
  )
}
