import {Stack} from 'expo-router'

import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

/**
 * Root secondary stacks (product, marketplace, …) hide the system header
 * so `SecondaryScreenHeader` owns progressive blur + glass icon chrome.
 */
export function SecondaryStackLayout() {
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
