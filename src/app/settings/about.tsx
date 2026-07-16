import {Platform} from 'react-native'

import {AppScreen} from '@/components/primitives/AppScreen'
import {AppText} from '@/components/primitives/AppText'
import {useTheme} from '@/theme/runtime/useTheme'

export default function AboutSettingsScreen() {
  const {scheme, resolvedColourMode, preferences, material, spacing} = useTheme()

  return (
    <AppScreen scroll>
      <AppText variant="display" colour="accent" style={{marginBottom: spacing.md}}>
        MODULA
      </AppText>
      <AppText>Simplifying Digital.</AppText>
      <AppText colour="textSecondary" style={{marginVertical: spacing.md}}>
        One identity. One environment. Infinite configurations.
      </AppText>
      <AppText>Fresh foundation — Expo SDK 57</AppText>
      <AppText>React Native · New Architecture</AppText>
      <AppText>Platform: {Platform.OS}</AppText>
      <AppText>Foundation status: Running</AppText>
      <AppText style={{marginTop: spacing.md}}>
        Theme: {preferences.colourMode} → {resolvedColourMode} ({scheme})
      </AppText>
      <AppText>
        Surface: {preferences.surfaceType} ({material.engine})
      </AppText>
      <AppText>Accent: {preferences.accent}</AppText>
      <AppText>Family: {preferences.family}</AppText>
    </AppScreen>
  )
}
