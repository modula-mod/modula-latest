import {Redirect} from 'expo-router'

/** First launch enters the Modula OS shell at Board. */
export default function Index() {
  return <Redirect href="/(tabs)/board" />
}
