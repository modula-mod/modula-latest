import {Stack} from 'expo-router'

import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export default function SettingsLayout() {
  const {colours} = useThemeTokens()

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: {backgroundColor: colours.canvas},
      }}
    />
  )
}
