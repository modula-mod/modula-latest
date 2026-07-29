#!/usr/bin/env node
import {createHash} from 'node:crypto'

if (process.env.PHASE7E_REAL_PROVIDER_SMOKE !== '1') {
  console.error('Set PHASE7E_REAL_PROVIDER_SMOKE=1 to run the opt-in real provider smoke test.')
  process.exit(1)
}

const apiKey = process.env.OPENAI_API_KEY
if (!apiKey) {
  console.error('OPENAI_API_KEY is required. The key is read from the process environment and is never printed.')
  process.exit(1)
}

const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini'
const baseUrl = process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1'
const response = await fetch(`${baseUrl.replace(/\/$/, '')}/responses`, {
  method: 'POST',
  headers: {
    authorization: `Bearer ${apiKey}`,
    'content-type': 'application/json',
    ...(process.env.OPENAI_ORGANIZATION ? {'OpenAI-Organization': process.env.OPENAI_ORGANIZATION} : {}),
    ...(process.env.OPENAI_PROJECT ? {'OpenAI-Project': process.env.OPENAI_PROJECT} : {}),
  },
  body: JSON.stringify({
    model,
    input: [
      {role: 'system', content: 'Return a compact JSON object only.'},
      {role: 'user', content: 'Return {"status":"ok"} for a Modula Phase 7E provider smoke test.'},
    ],
    max_output_tokens: 32,
    store: false,
    text: {
      format: {
        type: 'json_schema',
        name: 'modula_phase7e_smoke',
        strict: true,
        schema: {
          type: 'object',
          required: ['status'],
          properties: {status: {type: 'string'}},
          additionalProperties: false,
        },
      },
    },
  }),
})

const body = await response.json().catch(() => null)
if (!response.ok) {
  console.error(`OpenAI smoke request failed with HTTP ${response.status}. Response body is intentionally redacted.`)
  process.exit(1)
}

const outputText = extractOutputText(body)
if (!outputText) {
  console.error('OpenAI smoke request did not return output text.')
  process.exit(1)
}
const parsed = JSON.parse(outputText)
if (!parsed || parsed.status !== 'ok') {
  console.error('OpenAI smoke structured response failed validation. Output is intentionally redacted.')
  process.exit(1)
}
const usage = body?.usage
if (!usage || typeof usage.input_tokens !== 'number' || typeof usage.output_tokens !== 'number') {
  console.error('OpenAI smoke response did not include input/output token usage.')
  process.exit(1)
}

console.log(JSON.stringify({
  provider: 'provider:openai',
  model,
  status: 'ok',
  responseId: typeof body?.id === 'string' ? body.id : undefined,
  outputSha256Prefix: createHash('sha256').update(outputText).digest('hex').slice(0, 12),
  outputBytes: Buffer.byteLength(outputText, 'utf8'),
  usage: {
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    totalTokens: usage.total_tokens,
  },
}, null, 2))

function extractOutputText(body) {
  if (typeof body?.output_text === 'string') return body.output_text
  const output = Array.isArray(body?.output) ? body.output : []
  const parts = []
  for (const item of output) {
    for (const part of Array.isArray(item?.content) ? item.content : []) {
      if (typeof part?.text === 'string') parts.push(part.text)
    }
  }
  return parts.join('')
}
