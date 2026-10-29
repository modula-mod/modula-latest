import type {ResolvedAppearance} from '@/theme/contracts'

let lastCanvas: string | null = null

export async function syncSystemUI(resolved: ResolvedAppearance): Promise<void> {
  const canvas = resolved.colours.canvas
  if (lastCanvas === canvas || typeof document === 'undefined') return
  lastCanvas = canvas
  document.documentElement.style.backgroundColor = canvas
  document.body.style.backgroundColor = canvas
}
