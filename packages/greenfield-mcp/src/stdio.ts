#!/usr/bin/env node
import {callGreenfieldTool, serverInfo, toolDefinitions} from './index.js'

type JsonRpcId = string | number | null

type JsonRpcRequest = {
  jsonrpc?: '2.0'
  id?: JsonRpcId
  method?: string
  params?: unknown
}

type JsonRpcResponse =
  | {
      jsonrpc: '2.0'
      id: JsonRpcId
      result: unknown
    }
  | {
      jsonrpc: '2.0'
      id: JsonRpcId
      error: {
        code: number
        message: string
        data?: unknown
      }
    }

type StdioReadable = {
  on(event: 'data', listener: (chunk: unknown) => void): void
  on(event: 'end', listener: () => void): void
}

type StdioWritable = {
  write(chunk: string | Bytes): void
}

type Bytes = Uint8Array<ArrayBufferLike>

declare const process: {
  stdin: StdioReadable
  stdout: StdioWritable
  stderr: StdioWritable
  exitCode?: number
  on(event: 'uncaughtException', listener: (error: unknown) => void): void
  on(event: 'unhandledRejection', listener: (error: unknown) => void): void
}

const textDecoder = new TextDecoder()
const textEncoder = new TextEncoder()
const newlineByte = '\n'.charCodeAt(0)

let inputBuffer: Bytes = new Uint8Array(0)

process.stdin.on('data', chunk => {
  inputBuffer = concatBytes(inputBuffer, toBytes(chunk))
  drainInputBuffer()
})

process.stdin.on('end', () => {
  drainInputBuffer(true)
})

process.on('uncaughtException', error => {
  process.stderr.write(`modula-greenfield-mcp uncaught exception: ${formatError(error)}\n`)
  process.exitCode = 1
})

process.on('unhandledRejection', error => {
  process.stderr.write(`modula-greenfield-mcp unhandled rejection: ${formatError(error)}\n`)
  process.exitCode = 1
})

function drainInputBuffer(flush = false): void {
  while (inputBuffer.length > 0) {
    const frame = readContentLengthFrame(inputBuffer)

    if (frame.status === 'complete') {
      inputBuffer = inputBuffer.slice(frame.consumedBytes)
      handleJsonRpcText(frame.body)
      continue
    }

    if (frame.status === 'incomplete') {
      break
    }

    const newlineIndex = inputBuffer.indexOf(newlineByte)

    if (newlineIndex === -1) {
      if (!flush) {
        break
      }

      const body = textDecoder.decode(inputBuffer).trim()
      inputBuffer = new Uint8Array(0)

      if (body.length > 0) {
        handleJsonRpcText(body)
      }

      break
    }

    const lineBytes = inputBuffer.slice(0, newlineIndex)
    inputBuffer = inputBuffer.slice(newlineIndex + 1)
    const line = textDecoder.decode(lineBytes).trim()

    if (line.length > 0) {
      handleJsonRpcText(line)
    }
  }
}

function readContentLengthFrame(buffer: Bytes):
  | {status: 'complete'; body: string; consumedBytes: number}
  | {status: 'incomplete'}
  | {status: 'not-framed'} {
  const headerEnd = findHeaderEnd(buffer)

  if (headerEnd === null) {
    const text = textDecoder.decode(buffer)
    return /^Content-Length:/i.test(text) ? {status: 'incomplete'} : {status: 'not-framed'}
  }

  const headerText = textDecoder.decode(buffer.slice(0, headerEnd.index))
  const contentLength = parseContentLength(headerText)

  if (contentLength === null) {
    return {status: 'not-framed'}
  }

  const bodyStart = headerEnd.index + headerEnd.delimiterLength
  const frameEnd = bodyStart + contentLength

  if (buffer.length < frameEnd) {
    return {status: 'incomplete'}
  }

  return {
    status: 'complete',
    body: textDecoder.decode(buffer.slice(bodyStart, frameEnd)),
    consumedBytes: frameEnd,
  }
}

function handleJsonRpcText(text: string): void {
  let message: unknown

  try {
    message = JSON.parse(text)
  } catch (error) {
    writeResponse(errorResponse(null, -32700, 'Parse error', formatError(error)))
    return
  }

  if (!isRecord(message)) {
    writeResponse(errorResponse(null, -32600, 'Invalid Request'))
    return
  }

  const request = message as JsonRpcRequest
  const id = request.id ?? null

  if (request.jsonrpc !== undefined && request.jsonrpc !== '2.0') {
    writeResponse(errorResponse(id, -32600, 'Invalid Request'))
    return
  }

  if (typeof request.method !== 'string') {
    writeResponse(errorResponse(id, -32600, 'Invalid Request'))
    return
  }

  if (request.id === undefined) {
    handleNotification(request)
    return
  }

  writeResponse(handleRequest(request, id))
}

function handleNotification(request: JsonRpcRequest): void {
  if (request.method === 'notifications/initialized') {
    return
  }

  if (request.method !== undefined && request.method.startsWith('notifications/')) {
    return
  }
}

function handleRequest(request: JsonRpcRequest, id: JsonRpcId): JsonRpcResponse {
  switch (request.method) {
    case 'initialize':
      return successResponse(id, {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {},
        },
        serverInfo,
      })

    case 'tools/list':
      return successResponse(id, {
        tools: toolDefinitions,
      })

    case 'tools/call':
      return handleToolsCall(request.params, id)

    case 'ping':
      return successResponse(id, {})

    default:
      return errorResponse(id, -32601, `Method not found: ${request.method}`)
  }
}

function handleToolsCall(params: unknown, id: JsonRpcId): JsonRpcResponse {
  if (!isRecord(params) || typeof params.name !== 'string') {
    return errorResponse(id, -32602, 'Invalid params: tools/call requires a tool name')
  }

  return successResponse(id, callGreenfieldTool(params.name, params.arguments ?? {}))
}

function successResponse(id: JsonRpcId, result: unknown): JsonRpcResponse {
  return {
    jsonrpc: '2.0',
    id,
    result,
  }
}

function errorResponse(
  id: JsonRpcId,
  code: number,
  message: string,
  data?: unknown,
): JsonRpcResponse {
  return {
    jsonrpc: '2.0',
    id,
    error: {
      code,
      message,
      ...(data === undefined ? {} : {data}),
    },
  }
}

function writeResponse(response: JsonRpcResponse): void {
  const json = JSON.stringify(response)
  const body = textEncoder.encode(json)
  process.stdout.write(`Content-Length: ${body.byteLength}\r\n\r\n`)
  process.stdout.write(body)
}

function parseContentLength(headerText: string): number | null {
  for (const line of headerText.split(/\r?\n/)) {
    const match = /^Content-Length:\s*(\d+)\s*$/i.exec(line)

    if (match !== null) {
      return Number(match[1])
    }
  }

  return null
}

function findHeaderEnd(buffer: Bytes): {index: number; delimiterLength: number} | null {
  for (let index = 0; index < buffer.length - 1; index += 1) {
    if (buffer[index] === 10 && buffer[index + 1] === 10) {
      return {index, delimiterLength: 2}
    }

    if (
      index < buffer.length - 3 &&
      buffer[index] === 13 &&
      buffer[index + 1] === 10 &&
      buffer[index + 2] === 13 &&
      buffer[index + 3] === 10
    ) {
      return {index, delimiterLength: 4}
    }
  }

  return null
}

function toBytes(chunk: unknown): Bytes {
  if (typeof chunk === 'string') {
    return textEncoder.encode(chunk)
  }

  if (chunk instanceof Uint8Array) {
    return chunk
  }

  return textEncoder.encode(String(chunk))
}

function concatBytes(left: Bytes, right: Bytes): Bytes {
  const merged = new Uint8Array(left.length + right.length)
  merged.set(left)
  merged.set(right, left.length)
  return merged
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
