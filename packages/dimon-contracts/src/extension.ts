/**
 * Reserved first-party extension identity for a future DIMON economic plugin.
 * No balances, transfers, wallets, or issuance in Phase 6R.
 */
export const DIMON_EXTENSION_ID = 'modula.dimon.core' as const

export const DIMON_EXTENSION_KIND = 'plugin' as const

export type DimonExtensionReservation = {
  extensionId: typeof DIMON_EXTENSION_ID
  kind: typeof DIMON_EXTENSION_KIND
  publisher: 'modula'
}
