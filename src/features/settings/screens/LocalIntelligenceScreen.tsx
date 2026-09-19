import {useCallback, useEffect, useState} from 'react'
import {StyleSheet, View} from 'react-native'

import {
  isIntelligenceError,
  type IntelligenceDiagnosticsSnapshot,
} from '@modula/intelligence-core'

import {AppButton} from '@/components/primitives/AppButton'
import {AppScreen} from '@/components/primitives/AppScreen'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import {canAccessDeveloperLabs} from '@/lib/platform'
import {useAppServices} from '@/runtime'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type TestRunResult = {
  provider: string
  execution: string
  capability: string
  status: string
  detail?: string
}

/**
 * Greenfield developer lab for `@modula/intelligence-core` shared semantics.
 * This is not the modula-native on-device intelligence runtime.
 */
export function LocalIntelligenceScreen() {
  const {ai} = useAppServices()
  const {spacing} = useThemeTokens()
  const [snapshot, setSnapshot] = useState<IntelligenceDiagnosticsSnapshot | null>(null)
  const [privacyProbe, setPrivacyProbe] = useState<{pass: boolean; detail: string} | null>(null)
  const [testResult, setTestResult] = useState<TestRunResult | null>(null)

  const refresh = useCallback(async () => {
    const [nextSnapshot, probe] = await Promise.all([ai.getDiagnostics(), ai.privacyProbe()])
    setSnapshot(nextSnapshot)
    setPrivacyProbe(probe)
  }, [ai])

  useEffect(() => {
    const id = setTimeout(() => void refresh(), 0)
    return () => clearTimeout(id)
  }, [refresh])

  if (!canAccessDeveloperLabs()) {
    return (
      <AppScreen scroll>
        <View style={[styles.wrap, {gap: spacing[4], padding: spacing[4]}]}>
          <AppText variant="display">Intelligence Core Diagnostics</AppText>
          <AppText variant="body">Developer diagnostics are unavailable in production builds.</AppText>
        </View>
      </AppScreen>
    )
  }

  const runLocalTest = async () => {
    try {
      const result = await ai.execute({
        capability: 'summarize',
        input: {text: 'Modula intelligence-core shared-semantics diagnostic.'},
        privacy: 'local-only',
        metadata: {source: 'host', feature: 'intelligence-core-lab'},
      })
      setTestResult({
        provider: result.providerId,
        execution: result.execution === 'local' ? 'Local' : 'Remote',
        capability: result.capability,
        status: 'Success',
      })
    } catch (error) {
      setTestResult({
        provider: '—',
        execution: '—',
        capability: 'summarize',
        status: 'Failure',
        detail: isIntelligenceError(error) ? error.code : 'UNKNOWN',
      })
    }
    await refresh()
  }

  return (
    <AppScreen scroll>
      <View style={[styles.wrap, {gap: spacing[4], padding: spacing[4]}]}>
        <AppText variant="display">Intelligence Core Diagnostics</AppText>
        <AppText variant="body" colour="textSecondary">
          Exercises shared Greenfield contracts (router, privacy, tools). Native on-device inference
          lives in modula-native and is not connected here.
        </AppText>

        <Surface variant="contained" style={[styles.panel, {gap: spacing[3], padding: spacing[4]}]}>
          <Info label="Shared contracts" value="Ready" />
          <Info label="Router" value="Ready" />
          <Info
            label="Providers"
            value={`${snapshot?.providers ?? ai.providers.list().length} test provider(s)`}
          />
          <Info
            label="Local providers"
            value={String(snapshot?.localProviders ?? ai.providers.listByExecution('local').length)}
          />
          <Info
            label="Remote providers"
            value={String(snapshot?.remoteProviders ?? ai.providers.listByExecution('remote').length)}
          />
          <Info
            label="Local-only enforcement"
            value={privacyProbe ? (privacyProbe.pass ? 'PASS' : 'FAIL') : '…'}
          />
          <Info label="Native runtime" value="Not connected" />
          <Info label="Network required" value="No" />
        </Surface>

        <Surface variant="contained" style={[styles.panel, {gap: spacing[3], padding: spacing[4]}]}>
          <AppText variant="headline">Registered providers</AppText>
          {(snapshot?.providerStatuses ?? []).map(provider => (
            <Info
              key={provider.id}
              label={provider.id}
              value={
                provider.availability.state === 'available'
                  ? 'Available'
                  : provider.availability.state
              }
            />
          ))}
          {(snapshot?.providerStatuses.length ?? 0) === 0 ? (
            <AppText variant="body" colour="textSecondary">
              {ai.providers.list().length === 0
                ? 'No providers registered.'
                : 'Loading provider availability…'}
            </AppText>
          ) : null}
        </Surface>

        <Surface variant="contained" style={[styles.panel, {gap: spacing[3], padding: spacing[4]}]}>
          <AppText variant="headline">Privacy probe</AppText>
          <Info
            label="LOCAL ONLY"
            value={privacyProbe ? (privacyProbe.pass ? 'PASS' : 'FAIL') : '…'}
          />
          {privacyProbe ? (
            <AppText variant="caption" colour="textSecondary">
              {privacyProbe.detail}
            </AppText>
          ) : null}
        </Surface>

        <Surface variant="contained" style={[styles.panel, {gap: spacing[3], padding: spacing[4]}]}>
          <AppText variant="headline">Actions</AppText>
          <AppButton onPress={() => void runLocalTest()}>Run local test</AppButton>
          <AppButton variant="secondary" onPress={() => void refresh()}>
            Refresh diagnostics
          </AppButton>
          {testResult ? (
            <View style={{gap: spacing[2]}}>
              <Info label="Provider" value={testResult.provider} />
              <Info label="Execution" value={testResult.execution} />
              <Info label="Capability" value={testResult.capability} />
              <Info label="Status" value={testResult.status} />
              {testResult.detail ? <Info label="Detail" value={testResult.detail} /> : null}
            </View>
          ) : null}
        </Surface>
      </View>
    </AppScreen>
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
  info: {gap: 2},
  panel: {},
  wrap: {
    alignSelf: 'center',
    maxWidth: 820,
    width: '100%',
  },
})
