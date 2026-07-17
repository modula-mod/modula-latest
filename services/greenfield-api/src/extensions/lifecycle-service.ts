import type {ModulaDb} from '../database/client.js'
export class LifecycleService {
  constructor(private readonly db: ModulaDb) {}
  async setInstallationStatus(installationId: string, status: 'active' | 'disabled') {
    await this.db.updateTable('greenfield_extension_installations').set({status, updated_at: new Date()}).where('installation_id', '=', installationId).execute()
  }
}
