/**
 * Installation rows are never deleted: uninstalling keeps the row (and its
 * audit trail) and moves it to a terminal "not installed" status. The legacy
 * extension path writes `uninstalled`, the module lifecycle writes `removed`,
 * and the contract enum also carries `notInstalled`. Every read that answers
 * "what does this account have installed?" must exclude all three.
 */
export const NOT_INSTALLED_STATUSES = ['removed', 'uninstalled', 'notInstalled'] as const

export function isInstalledStatus(status: string | null | undefined): boolean {
  return typeof status === 'string' && status.length > 0 && !(NOT_INSTALLED_STATUSES as readonly string[]).includes(status)
}
