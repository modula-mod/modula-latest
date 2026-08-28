import {randomUUID} from 'node:crypto'

export const fixtureProductId = 'test.modula.module-owned-backend'
export const fixtureServiceId = 'service.test.modula.module-owned-backend'

export class ReferenceModuleBackend {
  constructor(pool) {
    this.pool = pool
  }

  async create(context, input) {
    assertContext(context)
    const title = requiredText(input?.title, 200, 'title')
    const body = requiredText(input?.body, 20_000, 'body')
    const recordId = `reference-record:${randomUUID()}`
    const result = await this.pool.query(
      'INSERT INTO reference_records(record_id,account_id,installation_id,title,body) VALUES($1,$2,$3,$4,$5) RETURNING *',
      [recordId, context.accountId, context.installationId, title, body],
    )
    return view(result.rows[0])
  }

  async get(context, recordId) {
    assertContext(context)
    const result = await this.pool.query(
      'SELECT * FROM reference_records WHERE record_id=$1 AND account_id=$2 AND installation_id=$3',
      [recordId, context.accountId, context.installationId],
    )
    if (!result.rows[0]) throw domainError('NOT_FOUND', 'Record not found')
    return view(result.rows[0])
  }

  async list(context) {
    assertContext(context)
    const result = await this.pool.query(
      'SELECT * FROM reference_records WHERE account_id=$1 AND installation_id=$2 ORDER BY created_at,record_id',
      [context.accountId, context.installationId],
    )
    return result.rows.map(view)
  }

  async update(context, recordId, input) {
    assertContext(context)
    const result = await this.pool.query(
      'UPDATE reference_records SET title=$1,body=$2,updated_at=NOW() WHERE record_id=$3 AND account_id=$4 AND installation_id=$5 RETURNING *',
      [requiredText(input?.title, 200, 'title'), requiredText(input?.body, 20_000, 'body'), recordId, context.accountId, context.installationId],
    )
    if (!result.rows[0]) throw domainError('NOT_FOUND', 'Record not found')
    return view(result.rows[0])
  }

  async exportData(context) {
    return {productId: fixtureProductId, installationId: context.installationId, records: await this.list(context)}
  }

  async deleteInstallationData(context) {
    assertContext(context)
    const result = await this.pool.query(
      'DELETE FROM reference_records WHERE account_id=$1 AND installation_id=$2',
      [context.accountId, context.installationId],
    )
    return {deleted: result.rowCount}
  }
}

function assertContext(context) {
  if (context?.productId !== fixtureProductId || !context.accountId || !context.installationId || context.serviceId !== fixtureServiceId) {
    throw domainError('FORBIDDEN', 'Invalid module service scope')
  }
}

function requiredText(value, maximum, field) {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text || text.length > maximum) throw domainError('VALIDATION_FAILED', `Invalid ${field}`)
  return text
}

function view(row) {
  return {recordId: row.record_id, accountId: row.account_id, installationId: row.installation_id, title: row.title, body: row.body}
}

function domainError(code, message) {
  return Object.assign(new Error(message), {code})
}
