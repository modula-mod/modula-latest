import {Stack} from 'expo-router'

import {LegalDraftScreen} from '@/features/legal/LegalDraftScreen'
import {PRIVACY_DRAFT} from '@/features/legal/legalDrafts'

export default function PrivacyRoute() {
  return (
    <>
      <Stack.Screen options={{title: 'Privacy Policy (Draft) · Modula', headerShown: false}} />
      <LegalDraftScreen document={PRIVACY_DRAFT} />
    </>
  )
}
