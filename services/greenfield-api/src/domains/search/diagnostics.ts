import type {ModulaDb} from '../../database/client.js'
import {SearchRepository} from './repository.js'

export class GreenfieldSearchDiagnosticsService {
  private readonly repository: SearchRepository

  constructor(db: ModulaDb) {
    this.repository = new SearchRepository(db)
  }

  health() {
    return this.repository.diagnostics()
  }
}
