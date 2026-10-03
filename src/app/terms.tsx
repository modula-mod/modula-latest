import {Stack} from 'expo-router'

import {LegalDraftScreen} from '@/features/legal/LegalDraftScreen'
import {TERMS_DRAFT} from '@/features/legal/legalDrafts'

export default function TermsRoute() {
  return (
    <>
      <Stack.Screen options={{title: 'Terms of Service (Draft) · Modula', headerShown: false}} />
      <LegalDraftScreen document={TERMS_DRAFT} />
    </>
  )
}
