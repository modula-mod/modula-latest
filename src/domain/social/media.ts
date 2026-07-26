export type PendingMediaAttachment = {
  localId: string
  kind: 'image'
  localUri: string
  base64?: string
  width?: number
  height?: number
  mimeType?: string
  altText?: string
}

export type RemoteMediaAsset = {
  id: string
  kind: 'image' | 'video'
  url: string
  width?: number
  height?: number
  altText?: string
  colour?: string
  aspectRatio?: number
  title?: string
}
