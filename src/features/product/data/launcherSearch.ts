import type {AppIconName} from '@/components/primitives/AppIcon'
import {marketplaceCatalog} from '@/features/marketplace/data/catalog'
import {COMMAND_CATALOGUE, type ModulaCommand} from '@/features/product/data/commandCatalogue'
import {ATLAS_DOMAIN_LABELS, atlasSearch} from '@/features/product/data/featureAtlas'
import {productCatalogue} from '@/features/product/data/productCatalogue'

export type LauncherSearchGroupId = 'commands' | 'capabilities' | 'modules' | 'atlas'

export type LauncherSearchHit = {
  id: string
  title: string
  subtitle: string
  body: string
  icon: AppIconName
  route?: string
  command?: ModulaCommand
}

export type LauncherSearchGroup = {
  id: LauncherSearchGroupId
  title: string
  hits: LauncherSearchHit[]
}

type LauncherSearchOptions = {
  defaultLimit?: number
  searchLimit?: number
}

const GROUP_TITLES: Record<LauncherSearchGroupId, string> = {
  commands: 'Commands',
  capabilities: 'Capabilities',
  modules: 'Modules',
  atlas: 'Atlas',
}

function matchesQuery(hit: LauncherSearchHit, query: string): boolean {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (terms.length === 0) return true

  const haystack = [hit.title, hit.subtitle, hit.body, hit.route, hit.command?.id]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  return terms.every(term => haystack.includes(term))
}

function limitHits(
  hits: LauncherSearchHit[],
  query: string,
  defaultLimit: number,
  searchLimit: number,
): LauncherSearchHit[] {
  const filtered = query ? hits.filter(hit => matchesQuery(hit, query)) : hits
  return filtered.slice(0, query ? searchLimit : defaultLimit)
}

export function getLauncherSearchGroups(
  query: string,
  options: LauncherSearchOptions = {},
): LauncherSearchGroup[] {
  const q = query.trim().toLowerCase()
  const defaultLimit = options.defaultLimit ?? 4
  const searchLimit = options.searchLimit ?? 12

  const commandHits: LauncherSearchHit[] = COMMAND_CATALOGUE.map(command => ({
    id: `command-${command.id}`,
    title: command.label,
    subtitle: `Command / ${command.risk} risk / confirm ${command.confirmation}`,
    body: [
      command.description,
      command.note,
      `Undo policy: ${command.undo}`,
      command.permissions.length
        ? `Permissions requested: ${command.permissions.join(', ')}`
        : 'Permissions requested: none',
    ]
      .filter(Boolean)
      .join('\n'),
    icon: 'developer',
    command,
  }))

  const capabilityHits: LauncherSearchHit[] = productCatalogue.map(item => ({
    id: `capability-${item.id}`,
    title: item.name,
    subtitle: `Capability / ${item.maturity} / ${item.eyebrow}`,
    body: `${item.summary}\n${item.body}`,
    icon: item.icon,
    route: item.ctaRoute ?? `/product/${item.id}`,
  }))

  const moduleHits: LauncherSearchHit[] = marketplaceCatalog.map(item => ({
    id: `module-${item.id}`,
    title: item.name,
    subtitle: `Module / ${item.status} / ${item.capability}`,
    body: `${item.description}\n${item.longDescription}`,
    icon: item.icon,
    route: `/marketplace/${item.id}`,
  }))

  const atlasHits: LauncherSearchHit[] = atlasSearch(q).map(feature => ({
    id: `atlas-${feature.id}`,
    title: feature.name,
    subtitle: `Atlas / ${ATLAS_DOMAIN_LABELS[feature.domain]} / ${feature.maturity}`,
    body: `${feature.summary}\nTags: ${feature.tags.join(', ')}`,
    icon: feature.icon ?? 'info',
    route: feature.route,
  }))

  return [
    {
      id: 'commands',
      title: GROUP_TITLES.commands,
      hits: limitHits(commandHits, q, defaultLimit, searchLimit),
    },
    {
      id: 'capabilities',
      title: GROUP_TITLES.capabilities,
      hits: limitHits(capabilityHits, q, defaultLimit, searchLimit),
    },
    {
      id: 'modules',
      title: GROUP_TITLES.modules,
      hits: limitHits(moduleHits, q, defaultLimit, searchLimit),
    },
    {
      id: 'atlas',
      title: GROUP_TITLES.atlas,
      hits: atlasHits.slice(0, q ? searchLimit : defaultLimit),
    },
  ]
}
