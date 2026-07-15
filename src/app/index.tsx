import {useState} from 'react'
import {Platform, StyleSheet, useColorScheme, View} from 'react-native'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppScreen} from '@/components/primitives/AppScreen'
import {AppText} from '@/components/primitives/AppText'
import {radius} from '@/theme/foundations/radius'
import {spacing} from '@/theme/foundations/spacing'
import {getSemanticColours} from '@/theme/tokens/semantic'

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
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light'
  const colours = getSemanticColours(scheme)
  const [interfaceCheck, setInterfaceCheck] = useState<'Not run' | 'Passed'>(
    'Not run',
  )

  return (
    <AppScreen style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <View style={styles.content}>
        <AppText variant="display" colour="accent" style={styles.brand}>
          MODULA
        </AppText>
        <AppText variant="body" style={{color: colours.text}}>
          Fresh foundation
        </AppText>
        <AppText variant="body" style={{color: colours.text}}>
          Expo SDK 57
        </AppText>
        <AppText variant="body" style={{color: colours.text}}>
          React Native
        </AppText>
        <AppText variant="body" style={{color: colours.text}}>
          New Architecture
        </AppText>
        <AppText variant="body" style={{color: colours.text}}>
          Platform: {platformLabel(Platform.OS)}
        </AppText>
        <AppText variant="body" style={{color: colours.text}}>
          Foundation status: Running
        </AppText>
        <AppText variant="body" style={{color: colours.text}}>
          Interface check: {interfaceCheck}
        </AppText>
        <AppPressable
          onPress={() => setInterfaceCheck('Passed')}
          style={[
            styles.button,
            {
              backgroundColor: colours.accent,
              borderRadius: radius.md,
            },
          ]}>
          <AppText variant="label" colour="accentForeground">
            Run interface check
          </AppText>
        </AppPressable>
      </View>
    </AppScreen>
  )
}

const styles = StyleSheet.create({
  screen: {
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  brand: {
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  button: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
})
