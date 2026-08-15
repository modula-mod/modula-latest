import {useCallback, useEffect, useState} from 'react'
import {View} from 'react-native'

import {AppText} from '@/components/primitives/AppText'
import {asRecord} from '@/api/decoding/validation'
import {
  SettingsCaption,
  SettingsScreen,
  SettingsSection,
} from '@/features/settings/components/SettingsRows'
import {useSession} from '@/auth/runtime'
import {useAppServices} from '@/runtime/useAppServices'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type MailIdentityView = {
  address: string | null
  status: string
  requiresOperatorAdoption: boolean
}

type MailCopy = {
  headline: string
  detail: string
}

export function ModulaMailSettingsScreen() {
  const session = useSession()
  const {apiClient} = useAppServices()
  const {spacing} = useThemeTokens()
  const [copy, setCopy] = useState<MailCopy>({
    headline: 'Checking mailbox state',
    detail: 'Reading Greenfield mail identity and provisioner mode.',
  })

  const load = useCallback(async () => {
    if (session.status !== 'signedIn') return
    let provisionerMode = 'unknown'
    try {
      const version = await apiClient.get({path: '/v1/version'}, decodeApiVersion)
      provisionerMode = version.provisionerMode
    } catch {
      provisionerMode = 'unknown'
    }
    try {
      const identity = await apiClient.get(
        {path: '/v1/accounts/me/modula-mail', authenticated: true},
        decodeMailIdentity,
      )
      setCopy(describeModulaMailState(identity, provisionerMode))
    } catch {
      setCopy({
        headline: 'Mailbox state unavailable',
        detail:
          'Could not read Modula Mail identity. Transactional mail still uses your sign-in email. This screen will not claim that a mailbox is active.',
      })
    }
  }, [apiClient, session.status])

  useEffect(() => {
    if (session.status !== 'signedIn') return undefined
    const id = setTimeout(() => void load(), 0)
    return () => clearTimeout(id)
  }, [load, session.status])

  return (
    <SettingsScreen
      title="Modula Mail"
      caption="This is mailbox identity, not sign-in email. Transactional verification, OTP, reset, and security-alert mail still send to the account email.">
      <SettingsSection title="Mailbox">
        <View style={{padding: spacing[4], gap: spacing[2]}} testID="modula-mail-state">
          <AppText variant="headline">{copy.headline}</AppText>
          <AppText variant="caption" colour="textSecondary">
            {copy.detail}
          </AppText>
        </View>
      </SettingsSection>
      <SettingsCaption>
        A disabled mail provisioner never means an ordinary user has a live @modula.digital inbox.
      </SettingsCaption>
    </SettingsScreen>
  )
}

function decodeApiVersion(value: unknown): {provisionerMode: string} {
  const row = asRecord(value, 'version')
  const mail =
    row.mailProvisioner && typeof row.mailProvisioner === 'object'
      ? asRecord(row.mailProvisioner, 'mailProvisioner')
      : null
  return {provisionerMode: typeof mail?.mode === 'string' ? mail.mode : 'unknown'}
}

function decodeMailIdentity(value: unknown): MailIdentityView | null {
  if (value == null) return null
  const row = asRecord(value, 'modula mail')
  return {
    address: typeof row.address === 'string' ? row.address : null,
    status: typeof row.status === 'string' ? row.status : 'unknown',
    requiresOperatorAdoption: Boolean(row.requiresOperatorAdoption),
  }
}

export function describeModulaMailState(
  identity: MailIdentityView | null,
  provisionerMode: string,
): MailCopy {
  const provisionerDisabled = provisionerMode === 'disabled' || provisionerMode === 'unknown'
  if (!identity) {
    return {
      headline: 'No Modula mailbox',
      detail: provisionerDisabled
        ? 'No @modula.digital mailbox is provisioned. The mail provisioner is disabled, so this account does not have an active inbox. Transactional mail still uses your sign-in email.'
        : 'No @modula.digital mailbox is provisioned for this account. Transactional mail still uses your sign-in email.',
    }
  }
  if (identity.requiresOperatorAdoption || identity.status === 'adoption_required') {
    return {
      headline: 'Operator adoption required',
      detail: `${identity.address ?? 'This mailbox'} is reserved for operator adoption. It is not an ordinary user inbox.`,
    }
  }
  if (identity.status === 'active' && !provisionerDisabled) {
    return {
      headline: identity.address ?? 'Mailbox active',
      detail: 'Greenfield records this mailbox as active and the mail provisioner is enabled.',
    }
  }
  if (identity.status === 'active' && provisionerDisabled) {
    return {
      headline: 'Mailbox not live',
      detail: `${identity.address ?? 'A mailbox'} is recorded in Greenfield, but the mail provisioner is disabled. This is not a live inbox.`,
    }
  }
  return {
    headline: 'Mailbox not active',
    detail: `Recorded state is ${identity.status}${identity.address ? ` for ${identity.address}` : ''}. ${
      provisionerDisabled
        ? 'The mail provisioner is disabled, so this is not an active inbox.'
        : 'Provisioning has not finished, so this is not an active inbox.'
    }`,
  }
}
