import type {FastifyInstance} from 'fastify'

import type {AppConfig} from '../config/env.js'
import type {ModulaDb} from '../database/client.js'
import {GameRuleError} from '../domains/moliboo-game/rules.js'
import {MolibooGameService} from '../domains/moliboo-game/service.js'
import {requireCapability} from '../security/auth-context.js'
import {failureEnvelope, statusForError, successEnvelope} from '../transport/envelope.js'

function mapError(reply: any, error: any, requestId: string, fallback: string) {
  if (error instanceof GameRuleError) {
    const envelope: any = failureEnvelope(error.code, error.message, requestId)
    if (error.detail !== undefined) envelope.error = {...envelope.error, detail: error.detail}
    return reply.code(statusForError(error.code)).send(envelope)
  }
  reply.log?.error?.({err: error}, fallback)
  return reply.code(statusForError('SERVER_ERROR')).send(failureEnvelope('SERVER_ERROR', fallback, requestId))
}

const idParam = () => ({type: 'string', minLength: 1, maxLength: 96, pattern: '^[A-Za-z0-9._-]+$'})
const params = (...names: string[]) => ({
  schema: {params: {type: 'object', additionalProperties: false, required: names, properties: Object.fromEntries(names.map(n => [n, idParam()]))}},
})

/**
 * MOLIBOO-GAME-SYSTEMS-01. Items catalogue, inventory, outfits, equip, signature
 * skills, care buffs, quests/achievements and mini-activity completions.
 * All state is per authenticated account and server-authoritative.
 */
export async function registerMolibooGameRoutes(
  app: FastifyInstance,
  db: ModulaDb,
  config: AppConfig,
  options: {feedConfig: Record<string, any>; writeConfig: Record<string, any>},
): Promise<void> {
  const game = new MolibooGameService(db, {premiumEnabled: config.premium.enabled})
  const read = (extra: Record<string, any> = {}) => ({...options.feedConfig, ...extra})
  const write = (extra: Record<string, any> = {}) => ({...options.writeConfig, ...extra})
  const handle = (cap: 'social:read' | 'profile:update', fallback: string, fn: (accountId: string, request: any) => Promise<unknown>, status = 200) =>
    async (request: any, reply: any) => {
      const auth = requireCapability(request, reply, cap)
      if (!auth) return
      try {
        return reply.code(status).send(successEnvelope(await fn(auth.accountId, request), request.id))
      } catch (error) {
        return mapError(reply, error, request.id, fallback)
      }
    }

  app.get('/v1/moliboo/catalogue/items', read(), handle('social:read', 'Unable to load items', (_a, r) => game.listItems(r.query ?? {})))
  app.get('/v1/moliboo/catalogue/outfits', read(), handle('social:read', 'Unable to load outfits', a => game.listOutfitSets(a)))
  app.get('/v1/moliboo/inventory', read(), handle('social:read', 'Unable to load inventory', a => game.inventory(a)))

  app.get('/v1/moliboo/outfits', read(), handle('social:read', 'Unable to load saved outfits', a => game.listSavedOutfits(a)))
  app.post('/v1/moliboo/outfits', write(), handle('profile:update', 'Unable to save outfit', (a, r) => game.saveOutfit(a, r.body ?? {}), 201))
  app.patch('/v1/moliboo/outfits/:outfitId', write(params('outfitId')), handle('profile:update', 'Unable to update outfit', (a, r) => game.updateOutfit(a, r.params.outfitId, r.body ?? {})))
  app.delete('/v1/moliboo/outfits/:outfitId', write(params('outfitId')), handle('profile:update', 'Unable to delete outfit', (a, r) => game.deleteOutfit(a, r.params.outfitId)))

  app.get('/v1/moliboo/characters/:characterId/state', read(params('characterId')), handle('social:read', 'Unable to load Moliboo state', (a, r) => game.characterState(a, r.params.characterId)))
  app.post('/v1/moliboo/characters/:characterId/equip', write(params('characterId')), handle('profile:update', 'Unable to equip', (a, r) => game.equip(a, r.params.characterId, r.body ?? {})))
  app.post('/v1/moliboo/characters/:characterId/care', write(params('characterId')), handle('profile:update', 'Unable to record care', (a, r) => game.care(a, r.params.characterId, r.body ?? {})))
  app.post('/v1/moliboo/characters/:characterId/skills/:skillId/use', write(params('characterId', 'skillId')), handle('profile:update', 'Unable to use skill', (a, r) => game.useSkill(a, r.params.characterId, r.params.skillId, r.body ?? {})))

  app.post('/v1/moliboo/activities/complete', write(), handle('profile:update', 'Unable to record activity', (a, r) => game.completeActivity(a, r.body ?? {})))
  app.get('/v1/moliboo/quests', read(), handle('social:read', 'Unable to load quests', a => game.quests(a)))
  app.post('/v1/moliboo/quests/:questId/claim', write(params('questId')), handle('profile:update', 'Unable to claim reward', (a, r) => game.claimQuest(a, r.params.questId, r.body ?? {})))
}
