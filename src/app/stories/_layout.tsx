import {Stack} from 'expo-router'

export default function StoriesLayout() {
  return (
    <Stack>
      <Stack.Screen name="create" options={{title: 'Add Story'}} />
      <Stack.Screen
        name="[groupId]"
        options={{title: 'Story', headerShown: false, presentation: 'fullScreenModal'}}
      />
    </Stack>
  )
}
