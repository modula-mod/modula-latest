import {Button, Column, Host, Switch, Text} from '@expo/ui/jetpack-compose'
import {useState} from 'react'
import {View} from 'react-native'

import {AppText} from '@/components/primitives/AppText'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

/**
 * Android-native Expo UI Compose examples. Product screens import adapters, not this file.
 */
export function ComposeLabSection() {
  const {spacing} = useThemeTokens()
  const [enabled, setEnabled] = useState(true)
  return (
    <View style={{gap: spacing[3], minHeight: 220}}>
      <AppText variant="headline">Jetpack Compose lab</AppText>
      <Host style={{flex: 1, minHeight: 180}}>
        <Column>
          <Text>Native Android controls via Expo UI</Text>
          <Button onClick={() => undefined}>Install</Button>
          <Switch value={enabled} onCheckedChange={setEnabled} />
        </Column>
      </Host>
    </View>
  )
}
