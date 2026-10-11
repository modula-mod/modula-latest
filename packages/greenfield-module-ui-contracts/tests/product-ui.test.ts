import {describe, expect, it} from 'vitest'
import {
  PRODUCT_UI_SCHEMA_VERSION,
  createHostCapabilityDiscovery,
  defineProductUiNode,
  negotiateHostCapabilities,
  validateHostCapabilityDescriptor,
  validateProductUiNode,
  type HostCapabilityDescriptor,
  type ProductUiNode,
} from '../src/index.js'

const capability = (id: string) => ({id, version: '1'})

describe('renderer-neutral Product UI contracts', () => {
  it('validates neutral alpha contracts for every advanced semantic primitive', () => {
    const alpha: ProductUiNode[] = [
      {id: 'alpha.editor', type: 'RichDocumentEditor', version: PRODUCT_UI_SCHEMA_VERSION, capability: capability('ui.document-editor'), documentField: 'body'},
      {id: 'alpha.editorToolbar', type: 'EditorToolbar', version: PRODUCT_UI_SCHEMA_VERSION, capability: capability('ui.editor-toolbar'), editorId: 'alpha.editor', actionIds: ['alpha.actions.bold']},
      {id: 'alpha.properties', type: 'PropertyEditor', version: PRODUCT_UI_SCHEMA_VERSION, capability: capability('ui.property-editor'), binding: 'alpha.record', fields: ['status', 'owner']},
      {id: 'alpha.reference', type: 'ReferencePicker', version: PRODUCT_UI_SCHEMA_VERSION, capability: capability('ui.reference-picker'), fieldPath: 'owner', recordType: 'contact'},
      {id: 'alpha.attachments', type: 'AttachmentGallery', version: PRODUCT_UI_SCHEMA_VERSION, capability: capability('ui.attachment-gallery'), binding: 'alpha.record', reorderable: true},
      {id: 'alpha.revisions', type: 'RevisionBrowser', version: PRODUCT_UI_SCHEMA_VERSION, capability: capability('ui.revision-browser'), recordBinding: 'alpha.record', restoreActionId: 'alpha.actions.restore'},
      {id: 'alpha.graph', type: 'Graph', version: PRODUCT_UI_SCHEMA_VERSION, capability: capability('ui.graph'), nodeBinding: 'alpha.nodes', edgeBinding: 'alpha.edges', layout: 'force'},
      {id: 'alpha.table', type: 'RecordTable', version: PRODUCT_UI_SCHEMA_VERSION, capability: capability('ui.record-table'), binding: 'alpha.records', columns: ['title', 'status']},
      {id: 'alpha.board', type: 'RecordBoard', version: PRODUCT_UI_SCHEMA_VERSION, capability: capability('ui.record-board'), binding: 'alpha.records', groupBy: 'status'},
      {id: 'alpha.commands', type: 'CommandMenu', version: PRODUCT_UI_SCHEMA_VERSION, capability: capability('ui.command-menu'), actionIds: ['alpha.actions.create'], search: true},
    ]

    for (const node of alpha) expect(validateProductUiNode(node).valid, node.type).toBe(true)
  })

  it('validates neutral beta basic semantics without naming a platform toolkit', () => {
    const beta = defineProductUiNode({
      id: 'beta.sheet',
      type: 'Sheet',
      version: PRODUCT_UI_SCHEMA_VERSION,
      capability: capability('ui.sheet'),
      presentation: 'sheet',
      children: [{
        id: 'beta.form',
        type: 'Form',
        version: PRODUCT_UI_SCHEMA_VERSION,
        capability: capability('ui.form'),
        binding: 'beta.record',
        submitActionId: 'beta.actions.save',
        children: [{
          id: 'beta.save',
          type: 'Button',
          version: PRODUCT_UI_SCHEMA_VERSION,
          capability: capability('ui.button'),
          label: 'Save',
          actionId: 'beta.actions.save',
          role: 'prominent',
        }],
      }],
    })
    expect(beta.type).toBe('Sheet')
    for (const node of [
      {id: 'beta.search', type: 'Search', version: PRODUCT_UI_SCHEMA_VERSION, capability: capability('ui.search'), queryBinding: 'beta.query'},
      {id: 'beta.menu', type: 'Menu', version: PRODUCT_UI_SCHEMA_VERSION, capability: capability('ui.menu'), label: 'Actions', actionIds: ['beta.actions.open']},
      {id: 'beta.toolbar', type: 'Toolbar', version: PRODUCT_UI_SCHEMA_VERSION, capability: capability('ui.toolbar'), actionIds: ['beta.actions.open']},
      {id: 'beta.list', type: 'List', version: PRODUCT_UI_SCHEMA_VERSION, capability: capability('ui.list'), binding: 'beta.records'},
    ]) expect(validateProductUiNode(node).valid).toBe(true)
  })

  it('requires the canonical capability for advanced primitives and rejects executable fields', () => {
    const missing = validateProductUiNode({id: 'alpha.graph', type: 'Graph', version: PRODUCT_UI_SCHEMA_VERSION, nodeBinding: 'alpha.nodes', edgeBinding: 'alpha.edges'})
    expect(missing.issues.map(issue => issue.code)).toContain('PRODUCT_UI_CAPABILITY_REQUIRED')
    const unsafe = validateProductUiNode({
      id: 'alpha.graph', type: 'Graph', version: PRODUCT_UI_SCHEMA_VERSION,
      capability: capability('ui.graph'), nodeBinding: 'alpha.nodes', edgeBinding: 'alpha.edges',
      render: 'customNativeView',
    })
    expect(unsafe.issues.map(issue => issue.code)).toContain('FORBIDDEN_PRODUCT_UI_KEY')
  })
})

describe('truthful host capability discovery', () => {
  const host = [
    {id: 'ui.graph', version: '1.0.0', status: 'unavailable'},
    {id: 'ui.record-table', version: '1.0.0', status: 'available', renderer: 'web.record-table'},
    {id: 'intelligence.local', version: '1.0.0', status: 'degraded', renderer: 'host.nodus-broker', constraints: {maximumInput: 4096, streaming: false}},
  ] satisfies HostCapabilityDescriptor[]

  it('fails a required unavailable capability with the canonical error', () => {
    const result = negotiateHostCapabilities({
      host,
      required: [{id: 'ui.graph', version: '1', fallback: {id: 'ui.record-table', version: '1'}}],
    })
    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe('CAPABILITY_UNAVAILABLE')
    expect(result.required[0]?.usedFallback).toBe(false)
  })

  it('uses only an explicitly declared optional fallback', () => {
    const explicit = negotiateHostCapabilities({
      host,
      optional: [{id: 'ui.graph', version: '1', fallback: {id: 'ui.record-table', version: '1'}}],
    })
    expect(explicit.ok).toBe(true)
    expect(explicit.optional[0]?.usedFallback).toBe(true)
    expect(explicit.optional[0]?.selected?.id).toBe('ui.record-table')

    const implicit = negotiateHostCapabilities({
      host: [{...host[0]!, fallback: {id: 'ui.record-table', version: '1'}}, host[1]!],
      optional: ['ui.graph@1'],
    })
    expect(implicit.optional[0]?.usedFallback).toBe(false)
    expect(implicit.optional[0]?.selected).toBeUndefined()
  })

  it('validates versioned descriptors and bounded constraints', () => {
    expect(validateHostCapabilityDescriptor(host[2]).valid).toBe(true)
    expect(validateHostCapabilityDescriptor({...host[2], constraints: {payload: {unbounded: true}}}).valid).toBe(false)
  })

  it('publishes a versioned host.capabilities discovery document', () => {
    const discovery = createHostCapabilityDiscovery(host)
    expect(discovery.schemaVersion).toBe('1.0.0')
    expect(discovery.capabilities.map(item => item.id)).toContain('intelligence.local')
    expect(() => createHostCapabilityDiscovery([host[1]!, host[1]!])).toThrow(/Duplicate host capability/)
  })
})
