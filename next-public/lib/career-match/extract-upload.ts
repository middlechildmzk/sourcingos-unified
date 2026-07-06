import 'server-only'
import { inflateRawSync, inflateSync } from 'node:zlib'

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024
const MIN_EXTRACTED_CHARS = 180

export interface UploadedResumeExtraction {
  text: string
  sourceName: string
  notes: string[]
}

function normalizeExtractedText(text: string): string {
  return String(text || '')
    .replace(/\r/g, '\n')
    .replace(/[\u0000\u0008\u000b\u000c\u000e-\u001f]+/g, ' ')
    .replace(/[\t\u00a0]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
}

function xmlToPlainText(xml: string): string {
  return normalizeExtractedText(
    decodeXmlEntities(xml)
      .replace(/<w:tab\b[^>]*\/>/g, ' ')
      .replace(/<w:br\b[^>]*\/>/g, '\n')
      .replace(/<\/w:p>/g, '\n')
      .replace(/<\/w:tr>/g, '\n')
      .replace(/<[^>]+>/g, '')
  )
}

function findZipEntries(buffer: Buffer) {
  const entries: Array<{ name: string; method: number; compressedSize: number; localOffset: number }> = []
  let eocdOffset = -1
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i
      break
    }
  }
  if (eocdOffset === -1) return entries

  const centralDirectorySize = buffer.readUInt32LE(eocdOffset + 12)
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16)
  let offset = centralDirectoryOffset
  const end = centralDirectoryOffset + centralDirectorySize

  while (offset + 46 <= end && offset + 46 <= buffer.length) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) break
    const method = buffer.readUInt16LE(offset + 10)
    const compressedSize = buffer.readUInt32LE(offset + 20)
    const nameLength = buffer.readUInt16LE(offset + 28)
    const extraLength = buffer.readUInt16LE(offset + 30)
    const commentLength = buffer.readUInt16LE(offset + 32)
    const localOffset = buffer.readUInt32LE(offset + 42)
    const name = buffer.subarray(offset + 46, offset + 46 + nameLength).toString('utf8')
    entries.push({ name, method, compressedSize, localOffset })
    offset += 46 + nameLength + extraLength + commentLength
  }

  return entries
}

function readZipEntry(buffer: Buffer, entry: { method: number; compressedSize: number; localOffset: number }): Buffer | null {
  const offset = entry.localOffset
  if (offset + 30 > buffer.length || buffer.readUInt32LE(offset) !== 0x04034b50) return null
  const nameLength = buffer.readUInt16LE(offset + 26)
  const extraLength = buffer.readUInt16LE(offset + 28)
  const dataStart = offset + 30 + nameLength + extraLength
  const dataEnd = dataStart + entry.compressedSize
  if (dataStart < 0 || dataEnd > buffer.length) return null
  const compressed = buffer.subarray(dataStart, dataEnd)
  if (entry.method === 0) return compressed
  if (entry.method === 8) return inflateRawSync(compressed)
  return null
}

function extractDocxText(buffer: Buffer): string {
  const entries = findZipEntries(buffer)
  const textParts: string[] = []
  const wanted = entries.filter(entry =>
    entry.name === 'word/document.xml' ||
    /^word\/(?:header|footer)\d+\.xml$/.test(entry.name)
  )

  for (const entry of wanted) {
    try {
      const data = readZipEntry(buffer, entry)
      if (!data) continue
      const text = xmlToPlainText(data.toString('utf8'))
      if (text) textParts.push(text)
    } catch {
      // Ignore individual zip entry failures. The caller validates minimum text length.
    }
  }

  return normalizeExtractedText(textParts.join('\n\n'))
}

function decodePdfLiteral(value: string): string {
  return value
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\n')
    .replace(/\\t/g, ' ')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\')
}

function decodePdfHex(hex: string): string {
  const clean = hex.replace(/\s+/g, '')
  if (!clean || clean.length % 2 !== 0) return ''
  const bytes = Buffer.from(clean, 'hex')
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) return bytes.subarray(2).toString('utf16le')
  return bytes.toString('utf8').replace(/[\u0000-\u001f]+/g, ' ')
}

function extractPdfTextFromContent(content: string): string[] {
  const parts: string[] = []
  const literalMatches = content.matchAll(/\((?:\\.|[^\\)]){2,}\)\s*Tj/g)
  for (const match of literalMatches) {
    const raw = match[0].replace(/\)\s*Tj$/, '').slice(1)
    const decoded = decodePdfLiteral(raw).trim()
    if (decoded.length > 1) parts.push(decoded)
  }

  const arrayMatches = content.matchAll(/\[((?:\s*\((?:\\.|[^\\)])*\)\s*)+)\]\s*TJ/g)
  for (const match of arrayMatches) {
    const inner = match[1]
    const literals = Array.from(inner.matchAll(/\((?:\\.|[^\\)])*\)/g)).map(m => decodePdfLiteral(m[0].slice(1, -1)))
    const joined = literals.join('').trim()
    if (joined.length > 1) parts.push(joined)
  }

  const hexMatches = content.matchAll(/<([0-9a-fA-F\s]{6,})>\s*Tj/g)
  for (const match of hexMatches) {
    const decoded = decodePdfHex(match[1]).trim()
    if (decoded.length > 1) parts.push(decoded)
  }

  return parts
}

function extractPdfText(buffer: Buffer): string {
  const chunks: string[] = []
  chunks.push(buffer.toString('latin1'))

  let searchStart = 0
  while (searchStart < buffer.length) {
    const streamMarker = buffer.indexOf('stream', searchStart, 'latin1')
    if (streamMarker === -1) break
    const streamStart = streamMarker + 'stream'.length
    const endMarker = buffer.indexOf('endstream', streamStart, 'latin1')
    if (endMarker === -1) break
    let dataStart = streamStart
    if (buffer[dataStart] === 0x0d && buffer[dataStart + 1] === 0x0a) dataStart += 2
    else if (buffer[dataStart] === 0x0a) dataStart += 1
    const raw = buffer.subarray(dataStart, endMarker)
    try {
      chunks.push(inflateSync(raw).toString('latin1'))
    } catch {
      try {
        chunks.push(inflateRawSync(raw).toString('latin1'))
      } catch {
        // Not a flate stream, ignore.
      }
    }
    searchStart = endMarker + 'endstream'.length
  }

  const parts = chunks.flatMap(extractPdfTextFromContent)
  const text = normalizeExtractedText(parts.join('\n'))
  if (text.length >= MIN_EXTRACTED_CHARS) return text

  // Last-resort fallback for simple text-based PDFs.
  return normalizeExtractedText(buffer.toString('utf8').replace(/[^\x09\x0a\x0d\x20-\x7e]+/g, ' '))
}

export async function extractResumeTextFromUpload(file: File): Promise<UploadedResumeExtraction> {
  if (file.size <= 0) throw new Error('The uploaded resume file is empty.')
  if (file.size > MAX_UPLOAD_BYTES) throw new Error('Resume file is too large. Please upload a file under 4MB or paste the resume text.')

  const name = file.name || 'resume'
  const lowerName = name.toLowerCase()
  const buffer = Buffer.from(await file.arrayBuffer())
  let text = ''
  const notes: string[] = []

  if (/\.(txt|md|text)$/i.test(lowerName) || file.type.startsWith('text/')) {
    text = buffer.toString('utf8')
    notes.push('Plain-text resume upload parsed directly.')
  } else if (/\.docx$/i.test(lowerName) || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    text = extractDocxText(buffer)
    notes.push('DOCX resume text extracted server-side from document XML. The raw file is not returned to the browser.')
  } else if (/\.pdf$/i.test(lowerName) || file.type === 'application/pdf') {
    text = extractPdfText(buffer)
    notes.push('PDF resume text extracted server-side. Scanned/image-only PDFs may require pasting text instead.')
  } else {
    throw new Error('Unsupported resume file type. Upload PDF, DOCX, TXT, or paste the resume text.')
  }

  text = normalizeExtractedText(text)
  if (text.length < MIN_EXTRACTED_CHARS) {
    throw new Error('Could not extract enough resume text from that file. If it is scanned or image-based, paste the resume text instead.')
  }

  return { text, sourceName: name, notes }
}
