import {useState} from 'react'
import {View} from 'react-native'
import {Stack, router} from 'expo-router'

import {AppAvatar} from '@/components/primitives/AppAvatar'
import {AppButton} from '@/components/primitives/AppButton'
import {AppChip} from '@/components/primitives/AppChip'
import {AppDivider} from '@/components/primitives/AppDivider'
import {AppScreen} from '@/components/primitives/AppScreen'
import {AppSearchField} from '@/components/primitives/AppSearchField'
import {AppText} from '@/components/primitives/AppText'
import {SystemSwitch} from '@/components/system'
import {useTheme} from '@/theme/runtime/useTheme'

export default function DevComponentsScreen() {
  const {colours, spacing} = useTheme()
  const [on, setOn] = useState(true)

  if (!__DEV__) {
    return (
      <AppScreen>
        <Stack.Screen options={{title: 'Developer', headerShown: true}} />
        <AppText>Component gallery is development-only.</AppText>
        <AppButton onPress={() => router.back()} style={{marginTop: 16}}>
          Back
        </AppButton>
      </AppScreen>
    )
  }

  return (
    <AppScreen scroll>
      <Stack.Screen
        options={{
          title: 'Component gallery',
          headerShown: true,
          headerTintColor: colours.accent,
        }}
      />
      <AppText variant="title" style={{marginBottom: spacing.md}}>
        Primitives
      </AppText>
      <AppText variant="display" colour="accent">
        MODULA
      </AppText>
      <AppSearchField placeholder="Search field" style={{marginVertical: spacing.md}} />
      <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm}}>
        <AppChip label="Topic" />
        <AppChip label="Selected" selected />
      </View>
      <AppDivider style={{marginVertical: spacing.md}} />
      <View style={{flexDirection: 'row', gap: spacing.md, alignItems: 'center'}}>
        <AppAvatar name="Modula Digital" size={48} />
        <AppButton>Primary</AppButton>
        <AppButton variant="secondary">Secondary</AppButton>
      </View>
      <AppDivider style={{marginVertical: spacing.md}} />
      <AppText variant="title" style={{marginBottom: spacing.md}}>
        System adapters
      </AppText>
      <SystemSwitch label="Demo switch" value={on} onValueChange={setOn} />
    </AppScreen>
  )
}
