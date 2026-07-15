import {Link, Stack} from 'expo-router'
import {StyleSheet, Text, View} from 'react-native'

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{title: 'Not found'}} />
      <View style={styles.screen}>
        <Text style={styles.title}>Screen not found</Text>
        <Link href="/" style={styles.link}>
          Return to foundation
        </Link>
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#FFFFFF',
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111111',
  },
  link: {
    fontSize: 16,
    color: '#369CAA',
  },
})
