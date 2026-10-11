import {createDb} from '../src/database/client.js'
import {loadConfig} from '../src/config/index.js'
import {GreenfieldModulePermissionReconciliationService} from '../src/modules/permission-reconciliation-service.js'

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

const installationId = argument('--installation-id')
const sourceReviewId = argument('--source-review-id')
const expected = argument('--expected-current-review-id')
const apply = process.argv.includes('--apply')
if (!installationId || !sourceReviewId) {
  throw new Error('--installation-id and --source-review-id are required')
}
if (apply && expected === undefined) {
  throw new Error('--apply requires --expected-current-review-id <review-id|none> from the dry-run')
}
if (process.argv.includes('--dry-run') && apply) throw new Error('Choose either --dry-run or --apply')

const databaseUrl = process.env.MODULA_DATABASE_MIGRATOR_URL ?? process.env.MODULA_DATABASE_URL
if (!databaseUrl) throw new Error('MODULA_DATABASE_MIGRATOR_URL or MODULA_DATABASE_URL is required')
const db = createDb(databaseUrl)

try {
  const service = new GreenfieldModulePermissionReconciliationService(db, loadConfig())
  const plan = await service.plan({installationId, sourceReviewId})
  if (!apply) {
    process.stdout.write(`${JSON.stringify({
      mode: 'dry-run',
      installationsExamined: 1,
      reviewsValid: plan.currentReviewId ? 1 : 0,
      reviewsMissing: plan.currentReviewId ? 0 : 1,
      legacyEquivalentsFound: plan.recoveredPermissions.length,
      newPermissionsRequiringReview: plan.reconciledDeniedPermissions.length,
      plan,
    }, null, 2)}\n`)
  } else {
    const result = await service.reconcile({
      installationId,
      sourceReviewId,
      expectedCurrentReviewId: expected === 'none' ? null : expected!,
      idempotencyKey: `permission-reconcile:${installationId}:${sourceReviewId}:${plan.currentReleaseId}`,
    })
    process.stdout.write(`${JSON.stringify({
      mode: 'applied',
      installationsReconciled: result.idempotent ? 0 : 1,
      requiringExplicitUserReview: result.reconciledDeniedPermissions.length ? 1 : 0,
      failed: 0,
      result,
    }, null, 2)}\n`)
  }
} finally {
  await db.destroy()
}
