import type {ModulaDb} from '../database/client.js'
import {GreenfieldEventBus} from '../events/index.js'
import {GreenfieldAIRepository, recordFromJson} from './repository.js'

export class GreenfieldAIStreamingRuntime {
  private readonly repository: GreenfieldAIRepository
  private readonly events: GreenfieldEventBus

  constructor(private readonly db: ModulaDb) {
    this.repository = new GreenfieldAIRepository(db)
    this.events = new GreenfieldEventBus(db)
  }

  async open(input: {
    requestId: string
    accountId: string
    actorId?: string | null
    moduleId: string
    correlationId: string
  }): Promise<{streamId: string; status: 'open'; lastSequence: number}> {
    const streamId = await this.repository.createStream(input)
    return {streamId, status: 'open', lastSequence: 0}
  }

  async appendToken(input: {streamId: string; token: string}): Promise<{streamId: string; type: 'token'; sequence: number; token: string}> {
    const stream = await this.repository.requireStream(input.streamId)
    const sequence = stream.last_sequence + 1
    await this.repository.updateStream({streamId: input.streamId, status: 'open', lastSequence: sequence})
    await this.events.publish({
      eventType: 'ai.stream.progress',
      aggregateType: 'aiStream',
      aggregateId: input.streamId,
      accountId: stream.account_id,
      actorId: stream.actor_id,
      requestId: stream.request_id,
      correlationId: stream.correlation_id,
      idempotencyKey: `${input.streamId}:token:${sequence}`,
      visibility: 'internal',
      classification: 'sensitive',
      payload: {
        streamId: input.streamId,
        requestId: stream.request_id,
        sequence,
        tokenBytes: Buffer.byteLength(input.token, 'utf8'),
      },
    })
    return {streamId: input.streamId, type: 'token', sequence, token: input.token}
  }

  async reconnect(streamId: string): Promise<{streamId: string; status: string; lastSequence: number}> {
    const stream = await this.repository.requireStream(streamId)
    if (stream.status === 'open') await this.repository.updateStream({streamId, status: 'reconnecting'})
    return {streamId, status: stream.status === 'open' ? 'reconnecting' : stream.status, lastSequence: stream.last_sequence}
  }

  async complete(input: {
    streamId: string
    structuredCompletion?: Record<string, unknown>
    usageDelta?: {inputTokens?: number; outputTokens?: number; estimatedCostMicrounits?: number}
  }): Promise<void> {
    const stream = await this.repository.requireStream(input.streamId)
    await this.repository.updateStream({
      streamId: input.streamId,
      status: 'completed',
      structuredCompletion: input.structuredCompletion ?? {},
      usageDelta: input.usageDelta ?? {},
    })
    await this.repository.updateRequestUsage(stream.request_id, {
      status: 'completed',
      inputTokens: input.usageDelta?.inputTokens,
      outputTokens: input.usageDelta?.outputTokens,
      estimatedCostMicrounits: input.usageDelta?.estimatedCostMicrounits,
      streamingUsed: true,
    })
    await this.events.publish({
      eventType: 'ai.completed',
      aggregateType: 'aiRequest',
      aggregateId: stream.request_id,
      accountId: stream.account_id,
      actorId: stream.actor_id,
      requestId: stream.request_id,
      correlationId: stream.correlation_id,
      idempotencyKey: `${input.streamId}:completed`,
      visibility: 'internal',
      classification: 'sensitive',
      payload: {
        requestId: stream.request_id,
        streamId: input.streamId,
        structuredCompletionKeys: Object.keys(recordFromJson(input.structuredCompletion)),
      },
    })
  }

  async cancel(streamId: string): Promise<void> {
    const stream = await this.repository.requireStream(streamId)
    await this.repository.updateStream({streamId, status: 'cancelled', cancellationRequested: true})
    await this.repository.updateRequestUsage(stream.request_id, {status: 'cancelled', streamingUsed: true})
    await this.events.publish({
      eventType: 'ai.cancelled',
      aggregateType: 'aiRequest',
      aggregateId: stream.request_id,
      accountId: stream.account_id,
      actorId: stream.actor_id,
      requestId: stream.request_id,
      correlationId: stream.correlation_id,
      idempotencyKey: `${streamId}:cancelled`,
      visibility: 'internal',
      classification: 'sensitive',
      payload: {requestId: stream.request_id, streamId},
    })
  }
}
