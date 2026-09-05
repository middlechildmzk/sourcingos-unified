import 'server-only'
import { inflateRawSync } from 'node:zlib'
import { SEED_CIVILIAN_OCCUPATIONS, SEED_MILITARY_OCCUPATIONS } from '@/data/military-occupations-seed-v33'
import { importMocRows, OFFICIAL_PROVENANCE, type RawMocRow } from './military-crosswalk-import-v33'
import type { CivilianOccupation, MilitaryOccupation, OccupationIndex, TaxonomyProvenance } from './military-talent-intelligence-v33'

const MOC_ZIP_URL = 'https://www.onetcenter.org/dl_files/2019/military_crosswalk.zip'
const ONET_DATA_ROOT = 'https://www.onetcenter.org/dl_files/database/db_31_0_json'
const CACHE_SECONDS = 60 * 60 * 24 * 7
const MAX_ZIP_BYTES = 32 * 1024 * 1024
const MAX_ENTRY_BYTES = 24 * 1024 * 1024

export type MilitaryDatasetStatus = {
  verified: boolean
  source: string
  version: string
  officialOccupationCount: number
  provisionalOccupationCount: number
  warnings: string[]
}

export type LoadedMilitaryDataset = {
  index: OccupationIndex
  status: MilitaryDatasetStatus
}

type CsvEntry = { name: string; text: string }
type OccupationRow = { onetsoc_code?: string; title?: string; description?: string }
type Dataset<T> = { row?: T[] }

function clean(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
}

function header(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { cell += '"'; i++; continue }
      if (char === '"') { quoted = false; continue }
      cell += char
      continue
    }
    if (char === '"') { quoted = true; continue }
    if (char === ',') { row.push(cell); cell = ''; continue }
    if (char === '\n') {
      row.push(cell.replace(/\r$/, ''))
      if (row.some(value => value.trim())) rows.push(row)
      row = []; cell = ''; continue
    }
    cell += char
  }
  row.push(cell.replace(/\r$/, ''))
  if (row.some(value => value.trim())) rows.push(row)
  return rows
}

function objects(entry: CsvEntry): Array<Record<string, string>> {
  const rows = parseCsv(entry.text)
  if (rows.length < 2) return []
  const keys = rows[0].map(header)
  return rows.slice(1).map(values => Object.fromEntries(keys.map((key, index) => [key, clean(values[index])])))
}

function first(row: Record<string, string>, keys: string[]): string {
  for (const key of keys) if (row[key]) return row[key]
  return ''
}

function branchName(service: string): string {
  const value = service.trim().toUpperCase()
  const map: Record<string, string> = {
    A: 'Army', ARMY: 'Army',
    N: 'Navy', NAVY: 'Navy',
    F: 'Air Force', AF: 'Air Force', AIRFORCE: 'Air Force',
    M: 'Marine Corps', MC: 'Marine Corps', MARINECORPS: 'Marine Corps',
    C: 'Coast Guard', G: 'Coast Guard', CG: 'Coast Guard', COASTGUARD: 'Coast Guard',
    S: 'Space Force', SF: 'Space Force', SPACEFORCE: 'Space Force',
  }
  return map[value.replace(/[^A-Z]/g, '')] || service
}

function serviceCategory(eo: string): string {
  const value = eo.trim().toUpperCase()
  if (value.startsWith('E')) return 'enlisted'
  if (value.startsWith('W')) return 'warrant'
  if (value.startsWith('O') || value.startsWith('C')) return 'officer'
  return ''
}

/** Turn the two official MOC tables into the normalized importer contract. */
export function mocRowsFromCsvEntries(entries: CsvEntry[]): RawMocRow[] {
  const tables = entries.map(entry => ({ entry, rows: objects(entry) })).filter(table => table.rows.length)
  const titleRows = tables.flatMap(table => table.rows).filter(row =>
    Boolean(first(row, ['moc'])) && Boolean(first(row, ['title', 'moc_title'])) && Boolean(first(row, ['svc', 'service', 'branch'])),
  )
  const crosswalkRows = tables.flatMap(table => table.rows).filter(row =>
    Boolean(first(row, ['moc'])) && Boolean(first(row, ['onetcode', 'onet_code', 'onetsoc_code', 'o_net_soc_code'])) && Boolean(first(row, ['svc', 'service', 'branch'])),
  )

  const titleByKey = new Map<string, Record<string, string>>()
  for (const row of titleRows) {
    const key = [first(row, ['svc', 'service', 'branch']), first(row, ['eo']), first(row, ['codesys', 'code_system']), first(row, ['moc'])].join('|').toUpperCase()
    titleByKey.set(key, row)
  }

  return crosswalkRows.map(row => {
    const svc = first(row, ['svc', 'service', 'branch'])
    const eo = first(row, ['eo'])
    const codeSystem = first(row, ['codesys', 'code_system'])
    const moc = first(row, ['moc'])
    const key = [svc, eo, codeSystem, moc].join('|').toUpperCase()
    const titleRow = titleByKey.get(key)
    const title = first(titleRow || {}, ['title', 'moc_title']) || first(row, ['title', 'moc_title']) || moc
    return {
      moc,
      branch: branchName(svc),
      moc_title: title,
      onetsoc_code: first(row, ['onetcode', 'onet_code', 'onetsoc_code', 'o_net_soc_code']),
      onetsoc_title: first(row, ['onet_title', 'onetsoc_title', 'title_onet']),
      active: true,
      service_category: serviceCategory(eo),
    }
  }).filter(row => row.moc && row.onetsoc_code)
}

function csvEntriesFromZip(buffer: Buffer): CsvEntry[] {
  if (buffer.length > MAX_ZIP_BYTES) throw new Error('O*NET military crosswalk archive exceeds the allowed size.')
  let eocd = -1
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65_557); i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) { eocd = i; break }
  }
  if (eocd < 0) throw new Error('O*NET military crosswalk archive is not a valid ZIP file.')

  const entryCount = Math.min(buffer.readUInt16LE(eocd + 10), 128)
  let cursor = buffer.readUInt32LE(eocd + 16)
  const entries: CsvEntry[] = []

  for (let index = 0; index < entryCount; index++) {
    if (buffer.readUInt32LE(cursor) !== 0x02014b50) break
    const method = buffer.readUInt16LE(cursor + 10)
    const compressedSize = buffer.readUInt32LE(cursor + 20)
    const uncompressedSize = buffer.readUInt32LE(cursor + 24)
    const nameLength = buffer.readUInt16LE(cursor + 28)
    const extraLength = buffer.readUInt16LE(cursor + 30)
    const commentLength = buffer.readUInt16LE(cursor + 32)
    const localOffset = buffer.readUInt32LE(cursor + 42)
    const name = buffer.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8')
    cursor += 46 + nameLength + extraLength + commentLength

    if (!/\.csv$/i.test(name)) continue
    if (uncompressedSize > MAX_ENTRY_BYTES || compressedSize > MAX_ENTRY_BYTES) throw new Error('O*NET military crosswalk CSV exceeds the allowed size.')
    if (buffer.readUInt32LE(localOffset) !== 0x04034b50) throw new Error('O*NET military crosswalk contains an invalid ZIP entry.')
    const localNameLength = buffer.readUInt16LE(localOffset + 26)
    const localExtraLength = buffer.readUInt16LE(localOffset + 28)
    const dataStart = localOffset + 30 + localNameLength + localExtraLength
    const compressed = buffer.subarray(dataStart, dataStart + compressedSize)
    const data = method === 0 ? compressed : method === 8 ? inflateRawSync(compressed) : null
    if (!data) continue
    entries.push({ name, text: data.toString('utf8') })
  }

  if (!entries.length) throw new Error('O*NET military crosswalk archive contained no CSV tables.')
  return entries
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { accept: 'application/json', 'user-agent': 'SourcingOS/1.0 military-role-intelligence' },
    next: { revalidate: CACHE_SECONDS },
    signal: AbortSignal.timeout(20_000),
  })
  if (!response.ok) throw new Error(`O*NET dataset returned ${response.status}.`)
  return response.json() as Promise<T>
}

async function officialCivilianOccupations(): Promise<CivilianOccupation[]> {
  const data = await getJson<Dataset<OccupationRow>>(`${ONET_DATA_ROOT}/occupation_data.json`)
  return (data.row || []).map(row => {
    const code = clean(row.onetsoc_code)
    return {
      onetSocCode: code,
      socCode: code.split('.')[0],
      title: clean(row.title),
      alternateTitles: [],
      occupationFamily: '',
      provenance: { ...OFFICIAL_PROVENANCE, source: 'O*NET 31.0 Database', version: '31.0' },
    }
  }).filter(item => item.onetSocCode && item.title)
}

/**
 * Load the authoritative O*NET-hosted MOC crosswalk. Official records remain
 * official-only; provisional seed records are appended only when no official
 * branch+code record exists. This prevents seed enrichment from masquerading as
 * authoritative crosswalk content.
 */
export async function loadMilitaryOccupationIndex(): Promise<LoadedMilitaryDataset> {
  try {
    const [zipResponse, civilian] = await Promise.all([
      fetch(MOC_ZIP_URL, {
        headers: { accept: 'application/zip', 'user-agent': 'SourcingOS/1.0 military-role-intelligence' },
        next: { revalidate: CACHE_SECONDS },
        signal: AbortSignal.timeout(20_000),
      }),
      officialCivilianOccupations(),
    ])
    if (!zipResponse.ok) throw new Error(`O*NET military crosswalk returned ${zipResponse.status}.`)
    const zip = Buffer.from(await zipResponse.arrayBuffer())
    const rawRows = mocRowsFromCsvEntries(csvEntriesFromZip(zip))
    if (!rawRows.length) throw new Error('O*NET military crosswalk could not be normalized into MOC rows.')

    const imported = importMocRows(rawRows, OFFICIAL_PROVENANCE)
    if (!imported.occupations.length) throw new Error('O*NET military crosswalk contained no usable occupations.')
    const officialKeys = new Set(imported.occupations.map(item => `${item.branch}:${item.code.toUpperCase()}`))
    const provisional = SEED_MILITARY_OCCUPATIONS.filter(item => !officialKeys.has(`${item.branch}:${item.code.toUpperCase()}`))
    const occupations: MilitaryOccupation[] = [...imported.occupations, ...provisional]

    return {
      index: { occupations, civilian },
      status: {
        verified: true,
        source: OFFICIAL_PROVENANCE.source,
        version: OFFICIAL_PROVENANCE.version,
        officialOccupationCount: imported.occupations.length,
        provisionalOccupationCount: provisional.length,
        warnings: imported.warnings.slice(0, 8),
      },
    }
  } catch (error) {
    return {
      index: { occupations: SEED_MILITARY_OCCUPATIONS, civilian: SEED_CIVILIAN_OCCUPATIONS },
      status: {
        verified: false,
        source: 'SourcingOS provisional development seed',
        version: 'seed-v33.0',
        officialOccupationCount: 0,
        provisionalOccupationCount: SEED_MILITARY_OCCUPATIONS.length,
        warnings: [error instanceof Error ? error.message.slice(0, 240) : 'Official O*NET MOC data could not be loaded.'],
      },
    }
  }
}

export const MILITARY_DATASET_PROVENANCE: TaxonomyProvenance = OFFICIAL_PROVENANCE
