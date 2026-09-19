import {describe, expect, it} from 'vitest'
import {IntelligenceError, IntelligenceToolRegistry} from '../src/index.js'

describe('IntelligenceToolRegistry', () => {
  it('registers and looks up tools', () => {
    const registry = new IntelligenceToolRegistry()
    registry.register({
      id: 'notes.summarize-selection',
      description: 'Summarize the current note selection',
      execution: 'read',
      permission: 'notes.read',
      inputSchema: {
        type: 'object',
        required: ['noteId'],
        properties: {
          noteId: {type: 'string'},
        },
        additionalProperties: false,
      },
    })
    expect(registry.get('notes.summarize-selection')?.execution).toBe('read')
    expect(registry.list()).toHaveLength(1)
  })

  it('rejects duplicate tool IDs', () => {
    const registry = new IntelligenceToolRegistry()
    const tool = {
      id: 'notes.search',
      description: 'Search notes',
      execution: 'read' as const,
      inputSchema: {type: 'object' as const, properties: {}},
    }
    registry.register(tool)
    expect(() => registry.register(tool)).toThrow(IntelligenceError)
  })

  it('rejects unknown tools', () => {
    const registry = new IntelligenceToolRegistry()
    const result = registry.validateCall({
      id: 'call-1',
      toolId: 'invented.by.model',
      arguments: {},
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('TOOL_NOT_FOUND')
  })

  it('rejects invalid arguments', () => {
    const registry = new IntelligenceToolRegistry()
    registry.register({
      id: 'notes.search',
      description: 'Search notes',
      execution: 'read',
      inputSchema: {
        type: 'object',
        required: ['query'],
        properties: {query: {type: 'string'}},
        additionalProperties: false,
      },
    })
    const missing = registry.validateCall({
      id: 'call-1',
      toolId: 'notes.search',
      arguments: {},
    })
    expect(missing.ok).toBe(false)
    if (!missing.ok) expect(missing.code).toBe('TOOL_ARGUMENTS_INVALID')

    const wrongType = registry.validateCall({
      id: 'call-2',
      toolId: 'notes.search',
      arguments: {query: 42},
    })
    expect(wrongType.ok).toBe(false)
    if (!wrongType.ok) expect(wrongType.code).toBe('TOOL_ARGUMENTS_INVALID')
  })

  it('rejects missing permissions', () => {
    const registry = new IntelligenceToolRegistry()
    registry.register({
      id: 'notes.create',
      description: 'Create a note',
      execution: 'write',
      permission: 'notes.write',
      inputSchema: {
        type: 'object',
        required: ['title'],
        properties: {title: {type: 'string'}},
      },
    })
    const denied = registry.validateCall(
      {id: 'call-1', toolId: 'notes.create', arguments: {title: 'Hello'}},
      ['notes.read'],
    )
    expect(denied.ok).toBe(false)
    if (!denied.ok) expect(denied.code).toBe('TOOL_PERMISSION_DENIED')

    const allowed = registry.validateCall(
      {id: 'call-2', toolId: 'notes.create', arguments: {title: 'Hello'}},
      ['notes.write'],
    )
    expect(allowed.ok).toBe(true)
  })
})
