import {useEffect, useState} from 'react'
import {View, StyleSheet} from 'react-native'
import {useLocalSearchParams} from 'expo-router'

import {AppButton} from '@/components/primitives/AppButton'
import {AppText} from '@/components/primitives/AppText'
import type {ExtensionCentreItem} from '@/data/repositories/contracts'
import {useAppServices} from '@/runtime/useAppServices'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function ExtensionDetailScreen() {
  const params = useLocalSearchParams<{extensionId?: string}>()
  const extensionId = typeof params.extensionId === 'string' ? params.extensionId : ''
  const services = useAppServices()
  const {colours, spacing} = useThemeTokens()
  const [item, setItem] = useState<ExtensionCentreItem | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void services.extensionRepository.getExtension(extensionId).then(next => {
      if (active) setItem(next)
    })
    return () => {
      active = false
    }
  }, [extensionId, services.extensionRepository])

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title={item?.name ?? 'Extension'} />
      <ResponsiveContent>
        <View style={[styles.content, {gap: spacing[3], padding: spacing[4]}]}>
          {item ? (
            <>
              <AppText variant="display">{item.name}</AppText>
              <AppText variant="body">{item.description}</AppText>
              <Info label="Publisher" value={item.publisher} />
              <Info label="Version" value={item.version} />
              <Info label="Type" value={item.kind} />
              <Info label="Status" value={item.status} />
              <Info label="Compatibility" value={item.compatibility} />
              <Info
                label="Permissions"
                value={item.permissions.length ? item.permissions.join(', ') : 'None listed'}
              />
              <AppButton
                variant="secondary"
                onPress={() => {
                  void services.extensionRepository.disable(item.extensionId).then(() =>
                    setMessage('Extension disabled for this account.'),
                  )
                }}>
                Disable
              </AppButton>
              <AppButton
                variant="secondary"
                onPress={() => {
                  void services.extensionRepository.uninstall(item.extensionId).then(() =>
                    setMessage('Extension uninstalled for this account.'),
                  )
                }}>
                Uninstall
              </AppButton>
              <AppText variant="caption" colour="textSecondary">
                Settings for first-party extensions appear here when the extension publishes a
                preferences schema.
              </AppText>
              {message ? (
                <AppText variant="caption" colour="textSecondary">
                  {message}
                </AppText>
              ) : null}
            </>
          ) : (
            <AppText variant="body">Extension not found.</AppText>
          )}
        </View>
      </ResponsiveContent>
    </View>
  )
}

function Info({label, value}: {label: string; value: string}) {
  return (
    <View style={styles.info}>
      <AppText variant="caption" colour="textSecondary">
        {label}
      </AppText>
      <AppText variant="bodyStrong">{value}</AppText>
    </View>
  )
}

const styles = StyleSheet.create({
  content: {maxWidth: 640, width: '100%', alignSelf: 'center', paddingBottom: 40},
  info: {gap: 2},
  screen: {flex: 1},
})
