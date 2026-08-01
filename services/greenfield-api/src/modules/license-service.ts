import type {GreenfieldModuleManifest} from '@modula/greenfield-module-manifest'

export type LicenseEvidenceSummary = {
  status: string
  approved: boolean
  evidenceSummary: string[]
}

export class GreenfieldModuleLicenseService {
  summarize(manifest: GreenfieldModuleManifest): LicenseEvidenceSummary {
    const evidenceSummary = manifest.license.evidenceIds.map(id => {
      if (id.includes('first-party')) return 'Modula first-party ownership policy'
      if (id.includes('founder')) return 'Founder override evidence'
      return `Evidence ${id}`
    })
    return {
      status: manifest.license.status,
      approved: manifest.license.status === 'firstParty' || manifest.license.status === 'verified' || manifest.license.status === 'founderOverride',
      evidenceSummary,
    }
  }
}
