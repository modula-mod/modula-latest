import type {ModulaDb} from '../database/client.js'
import {uuidv7} from '../lib/uuidv7.js'
import {invalidatePublicIdentity, VERIFICATION_TYPES, type VerificationType} from './badges.js'

type VerificationState = 'unverified' | 'pending' | 'under_review' | 'verified' | 'paused' | 'denied' | 'revoked'
type ApplicationState = Exclude<VerificationState, 'unverified'>

const TRANSITIONS: Record<ApplicationState, Partial<Record<string, ApplicationState>>> = {
  pending: {start_review: 'under_review', deny: 'denied'},
  under_review: {approve: 'verified', deny: 'denied', pause: 'paused'},
  verified: {pause: 'paused', revoke: 'revoked'},
  paused: {resume: 'verified', reopen: 'under_review', revoke: 'revoked'},
  denied: {},
  revoked: {},
}

export class VerificationService {
  constructor(private readonly db: ModulaDb) {}

  async me(accountId: string) {
    const status = await this.db.selectFrom('greenfield_verification_statuses').selectAll().where('account_id', '=', accountId).executeTakeFirst()
    const applications = await this.db.selectFrom('greenfield_verification_applications')
      .select(['application_id', 'requested_type', 'state', 'statement', 'review_reason', 'reverification_due_at', 'revision', 'created_at', 'updated_at'])
      .where('account_id', '=', accountId).orderBy('created_at', 'desc').execute()
    const appeals = await this.db.selectFrom('greenfield_verification_appeals')
      .select(['appeal_id', 'application_id', 'state', 'statement', 'review_reason', 'revision', 'created_at', 'updated_at'])
      .where('account_id', '=', accountId).orderBy('created_at', 'desc').execute()
    return {
      schemaVersion: 1,
      status: status?.state ?? 'unverified',
      type: status?.verification_type ?? null,
      effectiveAt: status?.effective_at.toISOString() ?? null,
      reverificationDueAt: status?.reverification_due_at?.toISOString() ?? null,
      revision: status?.revision ?? 0,
      documentCollection: {enabled: false},
      applications: applications.map(presentApplication),
      appeals: appeals.map(row => ({...row, created_at: undefined, updated_at: undefined, createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString()})),
    }
  }

  async createApplication(accountId: string, actorId: string, input: Record<string, unknown>) {
    const requestedType = String(input.type ?? '') as VerificationType
    if (!VERIFICATION_TYPES.includes(requestedType)) invalid(`type must be ${VERIFICATION_TYPES.join(', ')}`)
    const statement = optionalText(input.statement, 1000)
    const open = await this.db.selectFrom('greenfield_verification_applications').select('application_id').where('account_id', '=', accountId).where('state', 'in', ['pending', 'under_review', 'verified', 'paused']).executeTakeFirst()
    if (open) conflict('An active verification application already exists')
    const now = new Date()
    const applicationId = uuidv7()
    const previous = await this.db.selectFrom('greenfield_verification_statuses').select('state').where('account_id', '=', accountId).executeTakeFirst()
    await this.db.transaction().execute(async trx => {
      await trx.insertInto('greenfield_verification_applications').values({
        application_id: applicationId, account_id: accountId, requested_type: requestedType, state: 'pending', statement,
        submitted_by_actor_id: actorId, reviewer_actor_id: null, review_reason: null, reverification_due_at: null,
        revision: 1, created_at: now, updated_at: now,
      }).execute()
      await trx.insertInto('greenfield_verification_statuses').values({
        account_id: accountId, state: 'pending', verification_type: null, active_application_id: applicationId,
        effective_at: now, reverification_due_at: null, revision: (previous ? 2 : 1), updated_at: now,
      }).onConflict(oc => oc.column('account_id').doUpdateSet({state: 'pending', verification_type: null, active_application_id: applicationId, effective_at: now, reverification_due_at: null, revision: eb => eb('greenfield_verification_statuses.revision', '+', 1), updated_at: now})).execute()
      await this.insertEvent(trx as unknown as ModulaDb, {accountId, applicationId, appealId: null, eventType: 'application_created', from: previous?.state ?? 'unverified', to: 'pending', actorId, reason: null})
    })
    await this.invalidateAccount(accountId)
    return this.me(accountId)
  }

  async createAppeal(accountId: string, actorId: string, applicationId: string, input: Record<string, unknown>) {
    const application = await this.db.selectFrom('greenfield_verification_applications').selectAll().where('application_id', '=', applicationId).where('account_id', '=', accountId).executeTakeFirst()
    if (!application) notFound('Verification application not found')
    if (!['denied', 'revoked'].includes(application.state)) conflict('Only denied or revoked decisions may be appealed')
    const statement = requiredText(input.statement, 1000)
    const appealId = uuidv7()
    const now = new Date()
    await this.db.transaction().execute(async trx => {
      await trx.insertInto('greenfield_verification_appeals').values({
        appeal_id: appealId, application_id: applicationId, account_id: accountId, state: 'pending', statement,
        submitted_by_actor_id: actorId, reviewer_actor_id: null, review_reason: null, revision: 1, created_at: now, updated_at: now,
      }).execute()
      await this.insertEvent(trx as unknown as ModulaDb, {accountId, applicationId, appealId, eventType: 'appeal_created', from: application.state, to: application.state, actorId, reason: null})
    })
    return this.me(accountId)
  }

  async listApplications(state?: string) {
    let query = this.db.selectFrom('greenfield_verification_applications')
      .innerJoin('greenfield_accounts', 'greenfield_accounts.account_id', 'greenfield_verification_applications.account_id')
      .select(['greenfield_verification_applications.application_id', 'greenfield_verification_applications.requested_type', 'greenfield_verification_applications.state', 'greenfield_verification_applications.revision', 'greenfield_verification_applications.created_at', 'greenfield_verification_applications.updated_at', 'greenfield_accounts.primary_handle'])
      .orderBy('greenfield_verification_applications.created_at', 'asc')
    if (state) query = query.where('greenfield_verification_applications.state', '=', state as ApplicationState)
    const rows = await query.execute()
    return rows.map(row => ({applicationId: row.application_id, handle: row.primary_handle, type: row.requested_type, state: row.state, revision: row.revision, createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString()}))
  }

  async transition(reviewerActorId: string, applicationId: string, input: Record<string, unknown>) {
    const application = await this.db.selectFrom('greenfield_verification_applications').selectAll().where('application_id', '=', applicationId).executeTakeFirst()
    if (!application) notFound('Verification application not found')
    const action = String(input.action ?? '')
    const next = TRANSITIONS[application.state][action]
    if (!next) conflict(`Transition ${action || '(missing)'} is not allowed from ${application.state}`)
    const reason = optionalText(input.reason, 1000)
    if (['deny', 'pause', 'revoke'].includes(action) && !reason) invalid('reason is required for this transition')
    const reverificationDueAt = input.reverificationDueAt == null ? application.reverification_due_at : parseDate(input.reverificationDueAt)
    const now = new Date()
    await this.db.transaction().execute(async trx => {
      await trx.updateTable('greenfield_verification_applications').set({
        state: next, reviewer_actor_id: reviewerActorId, review_reason: reason,
        reverification_due_at: reverificationDueAt, revision: application.revision + 1, updated_at: now,
      }).where('application_id', '=', applicationId).where('revision', '=', application.revision).executeTakeFirstOrThrow()
      const existing = await trx.selectFrom('greenfield_verification_statuses').select('revision').where('account_id', '=', application.account_id).executeTakeFirst()
      await trx.insertInto('greenfield_verification_statuses').values({
        account_id: application.account_id, state: next, verification_type: next === 'verified' ? application.requested_type : null,
        active_application_id: applicationId, effective_at: now, reverification_due_at: reverificationDueAt,
        revision: (existing?.revision ?? 0) + 1, updated_at: now,
      }).onConflict(oc => oc.column('account_id').doUpdateSet({
        state: next, verification_type: next === 'verified' ? application.requested_type : null,
        active_application_id: applicationId, effective_at: now, reverification_due_at: reverificationDueAt,
        revision: (existing?.revision ?? 0) + 1, updated_at: now,
      })).execute()
      await this.insertEvent(trx as unknown as ModulaDb, {accountId: application.account_id, applicationId, appealId: null, eventType: `review_${action}`, from: application.state, to: next, actorId: reviewerActorId, reason})
    })
    await this.invalidateAccount(application.account_id)
    return this.me(application.account_id)
  }

  async transitionAppeal(reviewerActorId: string, appealId: string, input: Record<string, unknown>) {
    const appeal = await this.db.selectFrom('greenfield_verification_appeals').selectAll().where('appeal_id', '=', appealId).executeTakeFirst()
    if (!appeal) notFound('Verification appeal not found')
    const action = String(input.action ?? '')
    const next = action === 'start_review' && appeal.state === 'pending' ? 'under_review'
      : action === 'accept' && ['pending', 'under_review'].includes(appeal.state) ? 'accepted'
      : action === 'deny' && ['pending', 'under_review'].includes(appeal.state) ? 'denied'
      : null
    if (!next) conflict(`Appeal transition ${action || '(missing)'} is not allowed from ${appeal.state}`)
    const reason = optionalText(input.reason, 1000)
    if (['accept', 'deny'].includes(action) && !reason) invalid('reason is required for this transition')
    const now = new Date()
    await this.db.transaction().execute(async trx => {
      await trx.updateTable('greenfield_verification_appeals').set({state: next, reviewer_actor_id: reviewerActorId, review_reason: reason, revision: appeal.revision + 1, updated_at: now}).where('appeal_id', '=', appealId).where('revision', '=', appeal.revision).executeTakeFirstOrThrow()
      if (next === 'accepted') {
        const application = await trx.selectFrom('greenfield_verification_applications').selectAll().where('application_id', '=', appeal.application_id).executeTakeFirstOrThrow()
        await trx.updateTable('greenfield_verification_applications').set({state: 'under_review', reviewer_actor_id: reviewerActorId, review_reason: reason, revision: application.revision + 1, updated_at: now}).where('application_id', '=', appeal.application_id).execute()
        const status = await trx.selectFrom('greenfield_verification_statuses').select('revision').where('account_id', '=', appeal.account_id).executeTakeFirstOrThrow()
        await trx.updateTable('greenfield_verification_statuses').set({state: 'under_review', verification_type: null, active_application_id: appeal.application_id, effective_at: now, revision: status.revision + 1, updated_at: now}).where('account_id', '=', appeal.account_id).execute()
      }
      await this.insertEvent(trx as unknown as ModulaDb, {accountId: appeal.account_id, applicationId: appeal.application_id, appealId, eventType: `appeal_${action}`, from: appeal.state, to: next, actorId: reviewerActorId, reason})
    })
    await this.invalidateAccount(appeal.account_id)
    return this.me(appeal.account_id)
  }

  private async insertEvent(db: ModulaDb, input: {accountId: string; applicationId: string | null; appealId: string | null; eventType: string; from: string | null; to: string; actorId: string; reason: string | null}) {
    await db.insertInto('greenfield_verification_events').values({
      event_id: uuidv7(), account_id: input.accountId, application_id: input.applicationId, appeal_id: input.appealId,
      event_type: input.eventType, from_state: input.from, to_state: input.to, actor_id: input.actorId,
      reason: input.reason, audit_metadata: {syntheticQaDecision: input.eventType.startsWith('review_') || input.eventType.startsWith('appeal_')}, occurred_at: new Date(),
    }).execute()
  }

  private async invalidateAccount(accountId: string) {
    const actors = await this.db.selectFrom('actors').select('id').where('account_id', '=', accountId).execute()
    invalidatePublicIdentity(actors.map(row => row.id))
  }
}

function presentApplication(row: {application_id: string; requested_type: string; state: string; statement: string | null; review_reason: string | null; reverification_due_at: Date | null; revision: number; created_at: Date; updated_at: Date}) {
  return {applicationId: row.application_id, requestedType: row.requested_type, state: row.state, statement: row.statement, reviewReason: row.review_reason, reverificationDueAt: row.reverification_due_at?.toISOString() ?? null, revision: row.revision, createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString()}
}

function optionalText(value: unknown, max: number) {
  if (value == null) return null
  const text = String(value).trim()
  if (!text) return null
  if (text.length > max) invalid(`Text exceeds ${max} characters`)
  return text
}
function requiredText(value: unknown, max: number) { const text = optionalText(value, max); if (!text) invalid('statement is required'); return text }
function parseDate(value: unknown) { const date = new Date(String(value)); if (Number.isNaN(date.getTime())) invalid('Invalid timestamp'); return date }
function invalid(message: string): never { throw Object.assign(new Error(message), {code: 'VALIDATION_FAILED'}) }
function conflict(message: string): never { throw Object.assign(new Error(message), {code: 'CONFLICT'}) }
function notFound(message: string): never { throw Object.assign(new Error(message), {code: 'NOT_FOUND'}) }
