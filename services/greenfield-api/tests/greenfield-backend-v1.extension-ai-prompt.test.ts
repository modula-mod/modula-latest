import {createHash, randomUUID} from 'node:crypto'
import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {createDb, type ModulaDb} from '../src/database/client.js'
import {migrateUp} from '../src/database/migrate.js'
import {GreenfieldAIRepository} from '../src/ai/repository.js'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeIfDb = databaseUrl ? describe : describe.skip

describeIfDb('Greenfield immutable extension AI prompt binding', () => {
  let db: ModulaDb

  beforeAll(async () => {
    await migrateUp(databaseUrl!)
    db = createDb(databaseUrl!)
  })

  afterAll(async () => {
    await db?.destroy()
  })

  it('never overwrites an existing prompt identity on a conflicting registration', async () => {
    const repository = new GreenfieldAIRepository(db)
    const suffix = randomUUID()
    const promptId = `example.modula.extension-${suffix}.prompt.action`
    const firstTemplate = 'Signed prompt content from release A.'
    const first = await repository.registerPromptIfAbsent(prompt(promptId, `example.modula.extension-${suffix}`, firstTemplate))
    const conflict = await repository.registerPromptIfAbsent(prompt(promptId, `example.modula.other-${suffix}`, 'Conflicting release content.'))

    expect(first.templateHash).toBe(createHash('sha256').update(firstTemplate).digest('hex'))
    expect(conflict).toEqual(first)
  })
})

function prompt(promptId: string, moduleId: string, promptTemplate: string) {
  return {
    promptId,
    version: '1.0.0',
    owner: moduleId,
    moduleId,
    purpose: 'Immutable extension AI prompt test',
    variables: [],
    outputSchema: {},
    safetyPolicy: {source: 'signed-extension-product-action'},
    lifecycleStatus: 'active' as const,
    promptTemplate,
  }
}
