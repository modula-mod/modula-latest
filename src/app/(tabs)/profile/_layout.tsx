import {Stack} from 'expo-router'

import {nativeScreenHeaderOptions} from '@/platform/ui/navigation/native-screen-header'
import {
  ProfileHeaderLeft,
  ProfileHeaderRight,
} from '@/platform/ui/navigation/profile-stack-header'
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
        headerLeft: () => <ProfileHeaderLeft />,
        headerRight: () => <ProfileHeaderRight />,
      }}>
      <Stack.Screen
        name="index"
        options={{
          title: '',
          headerShown: false,
          headerTransparent: true,
          // expo-router's NativeStackNavigationOptions omits this; native-stack honors it.
          // @ts-expect-error native-stack zero top inset so the cover can bleed
          safeAreaInsets: {top: 0},
        }}
      />
    </Stack>
  )
}
