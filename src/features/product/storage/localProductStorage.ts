import AsyncStorage from '@react-native-async-storage/async-storage'

export async function getLocalProductValue(key: string): Promise<string | null> {
  return AsyncStorage.getItem(key)
}

export async function setLocalProductValue(
  key: string,
  value: string,
): Promise<void> {
  await AsyncStorage.setItem(key, value)
}
