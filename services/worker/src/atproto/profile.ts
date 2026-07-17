import type {WorkerDb} from '../database.js'

export async function handleAtprotoProfilePublish(_db: WorkerDb, _payload: Record<string, unknown>) {
  // Profile extension publication is opt-in via preferences; deferred live write.
  return
}
