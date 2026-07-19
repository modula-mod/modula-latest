import {DEFAULT_PROFILE_PRESENTATION} from '@/features/profile/contracts'
import type {ProfilePresentationPreferences} from '@/features/profile/contracts'
import {PROFILE_LAYOUT_BLOCKS} from '@/features/product/data/layoutBlocks'

/**
 * Apply Customize → Profile tab ids onto Profile presentation prefs.
 * Keeps posts required; appends any known catalog tabs not in the enabled set
 * to tabOrder so Customize Profile can re-enable them later.
 */
export function presentationFromProfileTabIds(
  profileTabIds: readonly string[],
  current: ProfilePresentationPreferences = DEFAULT_PROFILE_PRESENTATION,
): ProfilePresentationPreferences {
  const allowed = new Set(PROFILE_LAYOUT_BLOCKS.map(block => block.id))
  const enabledTabIds = [
    ...new Set(['posts', ...profileTabIds.filter(id => allowed.has(id))]),
  ]
  const rest = current.tabOrder.filter(id => !enabledTabIds.includes(id))
  const catalogRest = PROFILE_LAYOUT_BLOCKS.map(block => block.id).filter(
    id => !enabledTabIds.includes(id) && !rest.includes(id),
  )
  const tabOrder = [...enabledTabIds, ...rest, ...catalogRest]
  return {
    ...current,
    enabledTabIds,
    tabOrder,
    defaultTabId: enabledTabIds.includes(current.defaultTabId)
      ? current.defaultTabId
      : 'posts',
  }
}

/** Mirror live Customize Profile presentation back into product prefs. */
export function profileTabIdsFromPresentation(
  presentation: ProfilePresentationPreferences,
): string[] {
  const allowed = new Set(PROFILE_LAYOUT_BLOCKS.map(block => block.id))
  const ordered = presentation.tabOrder.filter(
    id => presentation.enabledTabIds.includes(id) && allowed.has(id),
  )
  const extras = presentation.enabledTabIds.filter(
    id => allowed.has(id) && !ordered.includes(id),
  )
  return [...new Set(['posts', ...ordered, ...extras])]
}
