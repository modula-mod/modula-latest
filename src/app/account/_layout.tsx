import {Stack} from 'expo-router'

import {SecondaryStackLayout} from '@/shell/SecondaryStackLayout'

export default function AccountLayout() {
  return (
    <SecondaryStackLayout>
      <Stack.Screen name="switcher" options={{presentation: 'modal'}} />
    </SecondaryStackLayout>
  )
}
