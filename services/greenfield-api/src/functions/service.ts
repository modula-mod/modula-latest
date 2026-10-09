import type {ModulaDb} from '../database/client.js'
import {requireInstallationCapabilityForAccount} from '../extensions/capability-resolver.js'
import {NOT_INSTALLED_STATUSES} from '../modules/installation-status.js'
import {safeFetch} from '../security/ssrf.js'
export class FunctionService {
  constructor(private readonly db: ModulaDb) {}

  async listForAccount(accountId: string) {
    return this.db
      .selectFrom('greenfield_functions')
      .innerJoin(
        'greenfield_extension_installations',
        'greenfield_extension_installations.extension_version_id',
        'greenfield_functions.extension_version_id',
      )
      .select([
        'greenfield_functions.function_id',
        'greenfield_extension_installations.installation_id',
        'greenfield_functions.name',
        'greenfield_functions.kind',
        'greenfield_functions.timeout_ms',
      ])
      .where('greenfield_extension_installations.account_id', '=', accountId)
      .where('greenfield_extension_installations.status', 'not in', [...NOT_INSTALLED_STATUSES])
      .orderBy('greenfield_functions.function_id')
      .execute()
  }

  async invoke(accountId: string, installationId: string, functionId: string, input: unknown) {
    const installation = await requireInstallationCapabilityForAccount(this.db, accountId, installationId, 'function:invoke')
    const fn = await this.db
      .selectFrom('greenfield_functions')
      .selectAll()
      .where('function_id', '=', functionId)
      .where('extension_version_id', '=', installation.extension_version_id)
      .executeTakeFirst()
    if (!fn) throw Object.assign(new Error('Function not found'), {code: 'NOT_FOUND'})
    if (fn.kind === 'remoteHttp') {
      const url = (fn.config as {url?: string}).url
      if (!url) throw Object.assign(new Error('Remote function URL missing'), {code: 'VALIDATION_FAILED'})
      const response = await safeFetch(url, {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(input), timeoutMs: Math.min(fn.timeout_ms, 10_000), maxResponseBytes: 1_048_576, allowedContentTypes: ['application/json']})
      return {status: response.status, output: JSON.parse(response.body.toString('utf8'))}
    }
    throw Object.assign(new Error('Function is queued for worker execution'), {code: 'CAPABILITY_DISABLED'})
  }
}
