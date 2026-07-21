import type {ModulaDb} from '../database/client.js'
import {uuidv7} from '../lib/uuidv7.js'

/** First-party Composer tools — availability reflects module readiness. */
export const FIRST_PARTY_TOOLS = [
  {slug: 'modula.tool.photo', displayName: 'Photo', availability: 'active'},
  {slug: 'modula.tool.camera', displayName: 'Camera', availability: 'active'},
  {slug: 'modula.tool.poll', displayName: 'Poll', availability: 'preview'},
  {slug: 'modula.tool.link', displayName: 'Link', availability: 'active'},
  {slug: 'modula.tool.commentToDm', displayName: 'Comment to DM', availability: 'preview'},
  {slug: 'modula.tool.automation', displayName: 'Automation', availability: 'preview'},
  {slug: 'modula.tool.aiAssist', displayName: 'AI Assist', availability: 'preview'},
  {slug: 'modula.tool.saveToVault', displayName: 'Save to Vault', availability: 'unavailable'},
  {slug: 'modula.tool.createTask', displayName: 'Create Task', availability: 'unavailable'},
] as const

export async function seedFirstPartyTools(db: ModulaDb): Promise<void> {
  const now = new Date()
  for (const tool of FIRST_PARTY_TOOLS) {
    await db
      .insertInto('greenfield_tools')
      .values({
        tool_id: uuidv7(),
        slug: tool.slug,
        display_name: tool.displayName,
        availability: tool.availability,
        manifest: {
          toolId: tool.slug,
          name: tool.displayName,
          surfaces: ['composer'],
          requiredCapabilities: [],
          firstParty: true,
        },
        created_at: now,
        updated_at: now,
      })
      .onConflict(oc => oc.column('slug').doNothing())
      .execute()
  }

  await db
    .insertInto('greenfield_bridges')
    .values({
      bridge_id: uuidv7(),
      slug: 'atproto',
      status: 'disabled',
      config: {optional: true, ownsAccounts: false},
      created_at: now,
    })
    .onConflict(oc => oc.column('slug').doNothing())
    .execute()
}
