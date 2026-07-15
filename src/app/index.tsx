import {useState} from 'react'
import {Platform, Pressable, StyleSheet, Text, View} from 'react-native'

function platformLabel(os: typeof Platform.OS): string {
  if (os === 'ios') {
    return 'iOS'
  }
  if (os === 'android') {
    return 'Android'
  }
  if (os === 'web') {
    return 'Web'
  }
  return os
}

export default function FoundationScreen() {
  const [interfaceCheck, setInterfaceCheck] = useState<'Not run' | 'Passed'>(
    'Not run',
  )

  return (
    <View style={styles.screen} accessibilityRole="summary">
      <Text style={styles.brand}>MODULA</Text>
      <Text style={styles.line}>Fresh foundation</Text>
      <Text style={styles.line}>Expo SDK 57</Text>
      <Text style={styles.line}>React Native</Text>
      <Text style={styles.line}>New Architecture</Text>
      <Text style={styles.line}>Platform: {platformLabel(Platform.OS)}</Text>
      <Text style={styles.line}>Foundation status: Running</Text>
      <Text style={styles.line}>Interface check: {interfaceCheck}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => setInterfaceCheck('Passed')}
        style={({pressed}) => [styles.button, pressed && styles.buttonPressed]}>
        <Text style={styles.buttonLabel}>Run interface check</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 8,
  },
  brand: {
    fontSize: 40,
    fontWeight: '700',
    letterSpacing: 2,
    color: '#369CAA',
    marginBottom: 8,
  },
  line: {
    fontSize: 16,
    color: '#111111',
    textAlign: 'center',
  },
  button: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#369CAA',
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
})
