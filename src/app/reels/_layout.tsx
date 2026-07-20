import {Stack} from 'expo-router'

import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export default function ReelsLayout() {
  const {colours} = useThemeTokens()

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: {backgroundColor: colours.canvas},
      }}>
      <Stack.Screen name="index" />
      <Stack.Screen
        name="algorithm"
        options={{
          presentation: 'card',
          animation: 'slide_from_right',
        }}
      />
    </Stack>
  )
}
