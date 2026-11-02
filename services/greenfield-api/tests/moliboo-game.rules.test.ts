import {describe, expect, it} from 'vitest'
import {applyBuff, friendshipBonusPct, friendshipLevel, GameRuleError, periodKey, pickSurprise, setCompletion, validateLoadout, type BuffDefinition, type CatalogueItem} from '../src/domains/moliboo-game/rules.js'

const defs = new Map<string, BuffDefinition>([
  ['fed', {buffId: 'fed', durationSeconds: 3600, stackRule: 'refresh', maxStacks: 1, exclusiveGroup: null, effects: {friendshipXpBonusPct: 10}}],
  ['play', {buffId: 'play', durationSeconds: 600, stackRule: 'stack', maxStacks: 3, exclusiveGroup: null, effects: {friendshipXpBonusPct: 5}}],
  ['rest', {buffId: 'rest', durationSeconds: 600, stackRule: 'refresh', maxStacks: 1, exclusiveGroup: 'mood', effects: {friendshipXpBonusPct: 10}}],
  ['chat', {buffId: 'chat', durationSeconds: 600, stackRule: 'stack', maxStacks: 2, exclusiveGroup: 'mood', effects: {friendshipXpBonusPct: 5}}],
  ['set', {buffId: 'set', durationSeconds: null, stackRule: 'while_equipped', maxStacks: 1, exclusiveGroup: 'set', effects: {}}],
])
const now = new Date('2026-11-01T12:00:00Z')

describe('Moliboo game rules', () => {
  it('refreshes, stacks up to the cap and honours exclusive groups', () => {
    const a = applyBuff([], defs.get('play')!, defs, now)
    expect(a.upsert.stacks).toBe(1)
    let active = [a.upsert]
    for (let i = 0; i < 5; i++) active = [applyBuff(active, defs.get('play')!, defs, now).upsert]
    expect(active[0]!.stacks).toBe(3)
    const fed = applyBuff([{buffId: 'fed', stacks: 1, startedAt: now, expiresAt: new Date(now.getTime() + 10)}], defs.get('fed')!, defs, now)
    expect(fed.upsert.stacks).toBe(1)
    expect(fed.upsert.expiresAt.getTime()).toBe(now.getTime() + 3600_000)
    const rest = applyBuff([{buffId: 'chat', stacks: 2, startedAt: now, expiresAt: new Date(now.getTime() + 60_000)}], defs.get('rest')!, defs, now)
    expect(rest.remove).toEqual(['chat'])
    expect(() => applyBuff([], defs.get('set')!, defs, now)).toThrow(GameRuleError)
  })

  it('caps the friendship bonus at 25%', () => {
    expect(friendshipBonusPct([{buffId: 'fed', stacks: 1}, {buffId: 'play', stacks: 3}, {buffId: 'rest', stacks: 1}], defs)).toBe(25)
    expect(friendshipBonusPct([{buffId: 'play', stacks: 2}], defs)).toBe(10)
  })

  it('computes period keys and a non-decaying level curve', () => {
    expect(periodKey('daily', now)).toBe('d:2026-11-01')
    expect(periodKey('weekly', now)).toBe('w:2026-W44')
    expect(periodKey('achievement', now)).toBe('all')
    expect(friendshipLevel(0)).toEqual({level: 1, xpIntoLevel: 0, xpForNext: 100})
    expect(friendshipLevel(260).level).toBe(3)
  })

  it('picks disclosed surprises deterministically and never an owned item', () => {
    const pool = ['a', 'b', 'c']
    const first = pickSurprise(pool, new Set(), 'acct|q|w')
    expect(pickSurprise(pool, new Set(), 'acct|q|w')).toBe(first)
    expect(pickSurprise(pool, new Set(['a', 'b']), 'x')).toBe('c')
    expect(pickSurprise(pool, new Set(pool), 'x')).toBeNull()
  })

  it('validates loadouts: one per slot, ownership for non-free, premium hidden when disabled', () => {
    const cat = new Map<string, CatalogueItem>([
      ['hat', {itemId: 'hat', slot: 'headwear', access: 'free', active: true}],
      ['crown', {itemId: 'crown', slot: 'headwear', access: 'earnable', active: true}],
      ['wings', {itemId: 'wings', slot: 'back', access: 'earnable', active: true}],
      ['robe', {itemId: 'robe', slot: 'outerwear', access: 'premium', active: true}],
    ])
    expect(validateLoadout(['wings', 'hat'], cat, new Set(['wings']), {premiumEnabled: false})).toEqual(['hat', 'wings'])
    expect(() => validateLoadout(['hat', 'crown'], cat, new Set(['crown']), {premiumEnabled: false})).toThrow(/Only one headwear/)
    try {
      validateLoadout(['crown'], cat, new Set(), {premiumEnabled: false})
      throw new Error('expected conflict')
    } catch (error: any) {
      expect(error.code).toBe('CONFLICT')
      expect(error.detail).toEqual({lockedItemIds: ['crown']})
    }
    expect(() => validateLoadout(['robe'], cat, new Set(['robe']), {premiumEnabled: false})).toThrow(/Unknown item/)
    expect(validateLoadout(['robe'], cat, new Set(['robe']), {premiumEnabled: true})).toEqual(['robe'])
    expect(() => validateLoadout(['robe'], cat, new Set(), {premiumEnabled: true})).toThrow(/not in your inventory/)
    expect(setCompletion(['hat', 'wings'], id => id === 'hat')).toEqual({owned: 1, total: 2, complete: false})
  })
})
