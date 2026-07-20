import {GREENFIELD_APPEARANCE_TEXT_SCALE_MAX, GREENFIELD_APPEARANCE_TEXT_SCALE_MIN, type GreenfieldAppearancePreferences, type GreenfieldAppearanceUpdateInput} from '@modula/greenfield-contracts'
import type {ModulaDb} from '../../database/client.js'
import type {Database} from '../../database/types.js'

const MODES = new Set(['system', 'light', 'dim', 'dark', 'oled'])
const VARIANTS = new Set(['standard', 'forest', 'ocean', 'plum', 'espresso', 'spaceGray'])
const SURFACES = new Set(['native', 'solid', 'glass', 'glay', 'minimalSpatial', 'skeuomorphic', 'neomorphic'])
export class AppearanceService {
  constructor(private readonly db: ModulaDb) {}
  async get(accountId: string): Promise<GreenfieldAppearancePreferences> {
    let row = await this.db.selectFrom('greenfield_appearance_preferences').selectAll().where('account_id', '=', accountId).executeTakeFirst()
    if (!row) {
      await this.db.insertInto('greenfield_appearance_preferences').values({account_id: accountId, mode: 'system', variant: 'standard', surface: 'native', accent_id: 'modula', custom_accent: null, text_scale: 1, bold_text: false, reduce_motion: false, reduce_transparency: false, increase_contrast: false, version: 1, updated_at: new Date()}).execute()
      row = await this.db.selectFrom('greenfield_appearance_preferences').selectAll().where('account_id', '=', accountId).executeTakeFirstOrThrow()
    }
    return this.map(row)
  }
  async patch(accountId: string, patch: GreenfieldAppearanceUpdateInput): Promise<GreenfieldAppearancePreferences> {
    const current = await this.get(accountId)
    if ((patch.mode && !MODES.has(patch.mode)) || (patch.variant && !VARIANTS.has(patch.variant)) || (patch.surface && !SURFACES.has(patch.surface)) || (patch.textScale !== undefined && (patch.textScale < GREENFIELD_APPEARANCE_TEXT_SCALE_MIN || patch.textScale > GREENFIELD_APPEARANCE_TEXT_SCALE_MAX))) throw Object.assign(new Error('Invalid appearance preference'), {code: 'VALIDATION_FAILED'})
    if (patch.expectedVersion !== undefined && patch.expectedVersion !== current.version) throw Object.assign(new Error('Version conflict'), {code: 'CONFLICT'})
    const updated = await this.db.updateTable('greenfield_appearance_preferences').set({mode: patch.mode ?? current.mode, variant: patch.variant ?? current.variant, surface: patch.surface ?? current.surface, accent_id: patch.accentId ?? current.accentId, custom_accent: patch.customAccent === undefined ? current.customAccent : patch.customAccent, text_scale: patch.textScale ?? current.textScale, bold_text: patch.boldText ?? current.boldText, reduce_motion: patch.reduceMotion ?? current.reduceMotion, reduce_transparency: patch.reduceTransparency ?? current.reduceTransparency, increase_contrast: patch.increaseContrast ?? current.increaseContrast, version: current.version + 1, updated_at: new Date()}).where('account_id', '=', accountId).where('version', '=', current.version).executeTakeFirst()
    if (!Number(updated.numUpdatedRows)) throw Object.assign(new Error('Version conflict'), {code: 'CONFLICT'})
    return this.get(accountId)
  }
  private map(row: Database['greenfield_appearance_preferences']): GreenfieldAppearancePreferences {
    return {mode: row.mode, variant: row.variant, surface: row.surface, accentId: row.accent_id, customAccent: row.custom_accent, textScale: Number(row.text_scale), boldText: row.bold_text, reduceMotion: row.reduce_motion, reduceTransparency: row.reduce_transparency, increaseContrast: row.increase_contrast, version: row.version, updatedAt: row.updated_at.toISOString()}
  }
}
