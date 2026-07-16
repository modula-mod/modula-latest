import {Stack} from 'expo-router'

import {ReelsScreen} from '@/features/reels/screens/ReelsScreen'

export default function ReelsRoute() {
  return (
    <>
      <Stack.Screen options={{headerShown: true, title: 'Reels', headerTransparent: true}} />
      <ReelsScreen />
    </>
  )
}
