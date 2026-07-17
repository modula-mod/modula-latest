import {createPrivateKey, createPublicKey, generateKeyPairSync, sign, verify} from 'node:crypto'
export type CheckpointSigner = {publicKey: string; sign(payload: string): string; verify(payload: string, signature: string): boolean}
export function createCheckpointSigner(seed?: string): CheckpointSigner {
  // Ed25519 is provided by Node/OpenSSL; production callers provide a PKCS#8 base64 key.
  const privateKey = seed ? createPrivateKey({key: Buffer.from(seed, 'base64'), format: 'der', type: 'pkcs8'}) : generateKeyPairSync('ed25519').privateKey
  const publicKey = createPublicKey(privateKey)
  const publicDer = publicKey.export({format: 'der', type: 'spki'}).toString('base64')
  return {publicKey: publicDer, sign: payload => sign(null, Buffer.from(payload), privateKey).toString('base64'), verify: (payload, signature) => verify(null, Buffer.from(payload), publicKey, Buffer.from(signature, 'base64'))}
}
