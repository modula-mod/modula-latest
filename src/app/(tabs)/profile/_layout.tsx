import {Stack} from 'expo-router'

import {nativeScreenHeaderOptions} from '@/platform/ui/navigation/native-screen-header'
import {
  ProfileHeaderLeft,
  ProfileHeaderRight,
  profileHeaderLeftItems,
  profileHeaderRightItems,
} from '@/platform/ui/navigation/profile-stack-header'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export default function ProfileStackLayout() {
  const {colours} = useThemeTokens()
  const rightItems = profileHeaderRightItems()
  const leftItems = profileHeaderLeftItems()

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
        ...(leftItems ? {unstable_headerLeftItems: () => leftItems} : null),
        ...(rightItems
          ? {unstable_headerRightItems: () => rightItems}
          : null),
      }}>
      <Stack.Screen name="index" />
    </Stack>
  )
}
