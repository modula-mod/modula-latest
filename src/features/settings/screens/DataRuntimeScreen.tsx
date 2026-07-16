import {useState} from 'react'
import {StyleSheet, View} from 'react-native'
import {useIsFetching, useIsMutating, useQueryClient} from '@tanstack/react-query'

import {AppButton} from '@/components/primitives/AppButton'
import {AppScreen} from '@/components/primitives/AppScreen'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import {runtimeEnvironment} from '@/config/runtimeEnvironment'
import {useNetworkStatus} from '@/data/network'
import {queryKeys} from '@/data/query'
import {useAppServices} from '@/runtime'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'
import type {LocalFailureMode, LocalLatencyMode} from '@/api/local'

export function DataRuntimeScreen() {
  const services = useAppServices()
  const controller = services.localApiController
  const queryClient = useQueryClient()
  const fetching = useIsFetching()
  const mutating = useIsMutating()
  const network = useNetworkStatus()
  const {spacing} = useThemeTokens()
  const [version, setVersion] = useState(0)
  const config = controller?.getConfiguration()

  const refresh = () => setVersion(value => value + 1)
  void version

  return (
    <AppScreen scroll>
      <View style={[styles.wrap, {gap: spacing[4], padding: spacing[4]}]}>
        <AppText variant="display">Data Runtime</AppText>
        <Surface variant="contained" style={[styles.panel, {gap: spacing[3], padding: spacing[4]}]}>
          <Info label="Data source" value={runtimeEnvironment.dataSource} />
          <Info label="Remote API" value={runtimeEnvironment.apiUrl ?? 'not configured'} />
          <Info label="Online" value={network.isOffline ? 'offline' : 'online'} />
          <Info label="Active query count" value={String(queryClient.getQueryCache().findAll().length)} />
          <Info label="Fetching" value={String(fetching)} />
          <Info label="Mutations" value={String(mutating)} />
        </Surface>
        {controller && config ? (
          <>
            <Surface variant="contained" style={[styles.panel, {gap: spacing[3], padding: spacing[4]}]}>
              <AppText variant="headline">Latency</AppText>
              <ButtonRow>
                {(['instant', 'normal', 'slow'] as LocalLatencyMode[]).map(mode => (
                  <AppButton key={mode} variant={config.latencyMode === mode ? 'primary' : 'secondary'} onPress={() => {controller.setLatencyMode(mode); refresh()}}>
                    {mode}
                  </AppButton>
                ))}
              </ButtonRow>
            </Surface>
            <Surface variant="contained" style={[styles.panel, {gap: spacing[3], padding: spacing[4]}]}>
              <AppText variant="headline">Failure simulation</AppText>
              <ButtonRow>
                {(['none', 'nextRequest', 'feed', 'mutations', 'authentication', 'allRequests'] as LocalFailureMode[]).map(mode => (
                  <AppButton key={mode} variant={config.failureMode === mode ? 'primary' : 'secondary'} onPress={() => {controller.setFailureMode(mode); refresh()}}>
                    {mode}
                  </AppButton>
                ))}
              </ButtonRow>
              <AppButton variant="secondary" onPress={() => {controller.expireAccessToken(); refresh()}}>
                Force session expiry
              </AppButton>
            </Surface>
            <Surface variant="contained" style={[styles.panel, {gap: spacing[3], padding: spacing[4]}]}>
              <AppText variant="headline">Query cache</AppText>
              <AppButton onPress={() => void queryClient.invalidateQueries({queryKey: queryKeys.feed.all})}>
                Invalidate Home feed
              </AppButton>
              <AppButton variant="secondary" onPress={() => queryClient.clear()}>
                Clear query cache
              </AppButton>
              <AppButton variant="secondary" onPress={() => {controller.resetLocalData(); queryClient.clear(); refresh()}}>
                Reset local API
              </AppButton>
              <AppButton variant="secondary" onPress={() => void queryClient.refetchQueries({type: 'active'})}>
                Refetch active queries
              </AppButton>
            </Surface>
          </>
        ) : null}
      </View>
    </AppScreen>
  )
}

function Info({label, value}: {label: string; value: string}) {
  return (
    <View style={styles.info}>
      <AppText variant="caption" colour="textSecondary">{label}</AppText>
      <AppText variant="bodyStrong">{value}</AppText>
    </View>
  )
}

function ButtonRow({children}: {children: React.ReactNode}) {
  return <View style={styles.row}>{children}</View>
}

const styles = StyleSheet.create({
  info: {gap: 2},
  panel: {},
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  wrap: {
    alignSelf: 'center',
    maxWidth: 820,
    width: '100%',
  },
})
