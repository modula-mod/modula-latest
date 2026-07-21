import AsyncStorage from '@react-native-async-storage/async-storage'

const ONBOARDING_COMPLETED_KEY = 'modula.onboarding.completed.v1'

export async function hasCompletedOnboarding(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(ONBOARDING_COMPLETED_KEY)
    return value === '1'
  } catch {
    return false
  }
}

export async function markOnboardingCompleted(): Promise<void> {
  try {
    await AsyncStorage.setItem(ONBOARDING_COMPLETED_KEY, '1')
  } catch {
    // Non-fatal — welcome still reaches auth.
  }
}

export async function resetOnboardingCompleted(): Promise<void> {
  try {
    await AsyncStorage.removeItem(ONBOARDING_COMPLETED_KEY)
  } catch {
    // ignore
  }
}
