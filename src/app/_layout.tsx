import {Stack} from 'expo-router'
import {StatusBar} from 'expo-status-bar'

import {ThemeProvider} from '@/theme/runtime/ThemeProvider'
import {useTheme} from '@/theme/runtime/useTheme'

function RootNavigator() {
  const {scheme, colours} = useTheme()

  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: {backgroundColor: colours.canvas},
        }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="compose"
          options={{presentation: 'modal', headerShown: false}}
        />
        <Stack.Screen name="settings" options={{headerShown: false}} />
        <Stack.Screen name="coming-soon" options={{presentation: 'card'}} />
        <Stack.Screen name="dev/components" options={{presentation: 'card'}} />
      </Stack>
    </>
  )
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootNavigator />
    </ThemeProvider>
  )
}
