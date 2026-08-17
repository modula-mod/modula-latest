/**
 * Profile Snapshot Pager — nested information architecture.
 *
 * Outer level (major profile surfaces):
 *   Overview → Modules → Links
 *
 * Inner level, only inside Overview:
 *   Metrics ↔ About
 *
 * Upper snapshot = compact preview / identity summary.
 * Lower Profile tabs = full destination content.
 * Semantic overlap (About / Modules / Links) is intentional.
 *
 * Overview is permanent and always first. Metrics and About stay
 * inside Overview for this phase — they are not outer pages.
 */

export type ProfileSnapshotPageId = 'overview' | 'modules' | 'links'

export type ProfileOverviewPage = 'metrics' | 'about'

export type ProfileSnapshotPageDescriptor = {
  id: ProfileSnapshotPageId
  order: number
  label: string
  number: string
  available: boolean
}

export const PROFILE_SNAPSHOT_OVERVIEW_PAGES: ProfileOverviewPage[] = [
  'metrics',
  'about',
]

export const CANONICAL_PROFILE_SNAPSHOT_PAGES: ProfileSnapshotPageDescriptor[] = [
  {id: 'overview', order: 0, label: 'Overview', number: '01', available: true},
  {id: 'modules', order: 1, label: 'Modules', number: '02', available: true},
  {id: 'links', order: 2, label: 'Links', number: '03', available: true},
]

export const DEFAULT_SNAPSHOT_PAGE: ProfileSnapshotPageId = 'overview'
export const DEFAULT_OVERVIEW_PAGE: ProfileOverviewPage = 'metrics'

export const MODULE_PREVIEW_COUNT = 4
export const LINK_PREVIEW_COUNT = 3

export function resolveProfileSnapshotPages(
  descriptors: ProfileSnapshotPageDescriptor[] = CANONICAL_PROFILE_SNAPSHOT_PAGES,
): ProfileSnapshotPageDescriptor[] {
  const available = descriptors.filter(page => page.available)
  const overview =
    available.find(page => page.id === 'overview') ??
    CANONICAL_PROFILE_SNAPSHOT_PAGES[0]
  const rest = available
    .filter(page => page.id !== 'overview')
    .sort((a, b) => a.order - b.order)
  return [overview, ...rest]
}

export function snapshotPageIndex(
  id: ProfileSnapshotPageId,
  pages: ProfileSnapshotPageDescriptor[],
): number {
  const index = pages.findIndex(page => page.id === id)
  return index >= 0 ? index : 0
}

export function overviewPageIndex(page: ProfileOverviewPage): number {
  return page === 'about' ? 1 : 0
}
