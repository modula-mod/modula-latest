import {Redirect} from 'expo-router'

/** Documented alias — Expo UI component gallery lives under Developer settings. */
export default function DevComponentsRoute() {
  return <Redirect href="/settings/developer/expo-ui" />
}
