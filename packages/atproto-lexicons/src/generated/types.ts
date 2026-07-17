export type ProfileExtensionRecord = {
  $type: 'digital.modula.temp.profileExtension'
  createdAt: string
  profileKind?: string
  publicWebsite?: string
  publicFocusStatus?: string
  capabilities?: Array<{
    id: string
    label?: string
  }>
}

export type ModuleManifestRecord = {
  $type: 'digital.modula.temp.moduleManifest'
  createdAt: string
  moduleId: string
  name: string
  publicDescription?: string
  publicVersion: string
  publisherDid: string
  repository?: string
  homepage?: string
  permissionSummary?: string
  compatibility?: string
}

export type PublicationRecord = {
  $type: 'digital.modula.temp.publication'
  createdAt: string
  post: {
    uri: string
    cid: string
  }
  contentKind?: string
  moduleId?: string
  modulaCanonicalUrl?: string
  presentation?: {
    mediaBacklight?: boolean
    profileTab?: string
  }
}
