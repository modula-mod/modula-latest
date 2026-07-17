import {MODULE_MANIFEST_NSID} from './generated/moduleManifest.js'
import {PROFILE_EXTENSION_NSID} from './generated/profileExtension.js'
import {PUBLICATION_NSID} from './generated/publication.js'

export const MODULA_LEXICON_NSIDS = [PROFILE_EXTENSION_NSID, MODULE_MANIFEST_NSID, PUBLICATION_NSID] as const

export type ModulaLexiconNsid = (typeof MODULA_LEXICON_NSIDS)[number]

export function isModulaLexiconNsid(value: string): value is ModulaLexiconNsid {
  return (MODULA_LEXICON_NSIDS as readonly string[]).includes(value)
}

/**
 * Collections the worker's selective ingestion is allowed to pull from a
 * connected actor's own PDS. This is not a Relay/AppView allow-list of the
 * whole network — only Modula's own experimental lexicons plus the single
 * standard Bluesky post collection needed for the read-only "atmosphere" view.
 */
export const ATPROTO_INGEST_COLLECTIONS = [
  'app.bsky.actor.profile',
  'app.bsky.feed.post',
  'app.bsky.graph.follow',
  ...MODULA_LEXICON_NSIDS,
] as const

export type AtprotoIngestCollection = (typeof ATPROTO_INGEST_COLLECTIONS)[number]

export function isIngestableCollection(value: string): value is AtprotoIngestCollection {
  return (ATPROTO_INGEST_COLLECTIONS as readonly string[]).includes(value)
}
