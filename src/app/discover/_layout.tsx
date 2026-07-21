import {Stack} from 'expo-router'

import {SecondaryStackLayout} from '@/shell/SecondaryStackLayout'

export default function DiscoverLayout() {
  return (
    <SecondaryStackLayout>
      <Stack.Screen name="feeds" options={{presentation: 'modal'}} />
      <Stack.Screen name="interests" options={{presentation: 'modal'}} />
    </SecondaryStackLayout>
  )
}
