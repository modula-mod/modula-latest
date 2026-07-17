import {createHash} from 'node:crypto'
export function checkpointPayloadHash(repositoryId: string, headHash: string, revision: number): string {
  return createHash('sha256').update(`${repositoryId}:${headHash}:${revision}`).digest('hex')
}
