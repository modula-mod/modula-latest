#!/usr/bin/env node
import {execFileSync} from 'node:child_process'
import {mkdtempSync, mkdirSync, readFileSync, rmSync, utimesSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {outputDir} from './lib.mjs'

const atlasPath = join(outputDir, 'api-atlas.json')
const outputPath = join(outputDir, 'api-atlas.docx')
const atlas = JSON.parse(readFileSync(atlasPath, 'utf8'))
const temporaryDirectory = mkdtempSync(join(tmpdir(), 'modula-api-atlas-docx-'))
const fixedDate = new Date('1980-01-01T00:00:00.000Z')

function escapeXml(value) {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function value(value) {
  if (value === null || value === undefined) return 'none'
  if (typeof value === 'string') return value
  return JSON.stringify(value)
}

function paragraph(text, style = null) {
  const styleProperty = style ? `<w:pPr><w:pStyle w:val="${escapeXml(style)}"/></w:pPr>` : ''
  return `<w:p>${styleProperty}<w:r><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`
}

function routeParagraphs(route) {
  const contract = route.contract
  const fallbackRequest = {
    params: route.request?.params ?? [],
    query: route.request?.query ?? [],
    body: route.request?.body ?? [],
    validation: route.request?.explicitFastifySchema ? 'Fastify schema registered.' : 'Handler/service validation; see source evidence.',
  }
  const fields = [
    ['Purpose', contract?.purpose ?? `${route.domain} ${route.method} endpoint; static/runtime record is authoritative.`],
    ['Owning domain', contract?.owningDomain ?? route.domain],
    ['Authentication', contract?.authentication ?? route.authentication],
    ['Authorization', contract?.authorization ?? route.authorization?.visibility],
    ['Request and validation', contract?.request ?? fallbackRequest],
    ['Success response', contract?.success ?? {status: route.successCodes, responseSchema: route.response?.schema ?? null}],
    ['Errors', contract?.errors ?? route.expectedErrors],
    ['Pagination and filtering', contract?.pagination ?? route.request?.pagination],
    ['Idempotency and concurrency', contract?.idempotencyConcurrency ?? 'Not separately declared; implementation semantics remain authoritative.'],
    ['Versioning and compatibility', contract?.versioningCompatibility ?? `HTTP ${route.apiVersion}; no mission-specific compatibility override.`],
    ['Source', route.source ? `${route.source.file}:${route.source.line}` : 'unmatched'],
    ['Runtime status', route.status],
  ]
  return [
    paragraph(`${route.method} ${route.effectiveRoute}`, 'Heading2'),
    ...fields.map(([label, contents]) => paragraph(`${label}: ${value(contents)}`)),
  ]
}

const documentBody = [
  paragraph('MODULA GREENFIELD HTTP API ATLAS', 'Title'),
  paragraph(`Evidence: ${atlas.metadata.runtimeEvidence.kind}; application routes: ${atlas.reconciliation.applicationRuntimeRoutes}; runtime method routes: ${atlas.reconciliation.runtimeMethodRoutes}.`),
  paragraph('This DOCX is generated from api-atlas.json. Mission-specific contract overrides are embedded in the same canonical route records used for CSV, Markdown and OpenAPI output.'),
  ...atlas.routes.flatMap(routeParagraphs),
  '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>',
].join('')

const files = {
  '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>',
  '_rels/.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>',
  'docProps/core.xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>Modula GreenField HTTP API Atlas</dc:title><dc:creator>Modula API Atlas generator</dc:creator><cp:lastModifiedBy>Modula API Atlas generator</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">1980-01-01T00:00:00Z</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">1980-01-01T00:00:00Z</dcterms:modified></cp:coreProperties>',
  'docProps/app.xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Modula API Atlas generator</Application><DocSecurity>0</DocSecurity><ScaleCrop>false</ScaleCrop><Company>Modula</Company><LinksUpToDate>false</LinksUpToDate><SharedDoc>false</SharedDoc><HyperlinksChanged>false</HyperlinksChanged><AppVersion>1.0</AppVersion></Properties>',
  'word/document.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${documentBody}</w:body></w:document>`,
  'word/styles.xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="240"/></w:pPr><w:rPr><w:b/><w:sz w:val="32"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="120"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:sz w:val="26"/></w:rPr></w:style></w:styles>',
  'word/_rels/document.xml.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
}

try {
  for (const [relativePath, contents] of Object.entries(files)) {
    const target = join(temporaryDirectory, relativePath)
    mkdirSync(join(target, '..'), {recursive: true})
    writeFileSync(target, contents)
    utimesSync(target, fixedDate, fixedDate)
  }
  rmSync(outputPath, {force: true})
  execFileSync('zip', ['-X', '-q', outputPath, ...Object.keys(files).sort()], {cwd: temporaryDirectory})
} finally {
  rmSync(temporaryDirectory, {recursive: true, force: true})
}
