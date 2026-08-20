import {layerZIndex} from '@/theme/tokens/layers'

/** Semantic z-order for universal post layers. */
export const POST_LAYERS = {
  content: layerZIndex('content'),
  captionScrim: layerZIndex('raisedContent'),
  chrome: layerZIndex('sticky'),
  interaction: layerZIndex('navigation'),
  transient: layerZIndex('sheet'),
} as const

export type PostLayerId = keyof typeof POST_LAYERS

export function postLayerZ(id: PostLayerId): number {
  return POST_LAYERS[id]
}
