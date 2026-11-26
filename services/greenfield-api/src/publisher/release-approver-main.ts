import {createDb} from '../database/client.js'
import {
  releaseApprovalPolicyFromEnvironment,
  releaseApprovalRequestFromArguments,
  RestrictedPublisherReleaseApprover,
} from './restricted-release-approver.js'

/** One explicit approval per invocation; this process never auto-discovers or auto-approves jobs. */
async function main() {
  const databaseUrl = process.env.MODULA_RELEASE_APPROVER_DATABASE_URL?.trim()
  if (!databaseUrl) throw new Error('MODULA_RELEASE_APPROVER_DATABASE_URL is required')
  const policy = releaseApprovalPolicyFromEnvironment(process.env)
  const request = releaseApprovalRequestFromArguments(process.argv.slice(2))
  const db = createDb(databaseUrl, error => console.error('release approver database pool error', error.message), {
    applicationName: `modula-release-approver:${policy.policyId}`,
    max: 1,
  })
  try {
    const receipt = await new RestrictedPublisherReleaseApprover(db, policy).approve(request)
    console.info(JSON.stringify({event: 'release_approval_recorded', ...receipt}))
  } finally {
    await db.destroy()
  }
}

void main()
