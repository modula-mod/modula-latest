import type {ModulaDb} from '../database/client.js'
export class ExtensionRegistry {
  constructor(private readonly db: ModulaDb) {}
  listPublished() { return this.db.selectFrom('greenfield_extension_versions').innerJoin('greenfield_extensions', 'greenfield_extensions.extension_id', 'greenfield_extension_versions.extension_id').select(['greenfield_extensions.slug', 'greenfield_extension_versions.version', 'greenfield_extension_versions.manifest']).where('greenfield_extension_versions.status', '=', 'published').execute() }
}
